import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from '@/lib/prisma';
import { compare } from "bcrypt";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.error('[authorize] Missing credentials');
          throw new Error("Invalid credentials");
        }

        console.log('[authorize] Looking for user with email:', credentials.email);
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        if (!user) {
          console.error('[authorize] User not found');
          throw new Error("User not found");
        }

        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          console.error('[authorize] Invalid password');
          throw new Error("Invalid password");
        }

        console.log('[authorize] User authenticated:', {
          id: user.id,
          email: user.email,
          name: user.name,
          organization: user.organization
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organization: user.organization
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      console.log('[jwt] Token before:', token);
      console.log('[jwt] User:', user);
      
      if (user) {
        token.id = user.id;
        token.organization = user.organization;
      }

      console.log('[jwt] Token after:', token);
      return token;
    },
    async session({ session, token }) {
      console.log('[session] Session before:', session);
      console.log('[session] Token:', token);
      
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.organization = token.organization;
      }

      console.log('[session] Session after:', session);
      return session;
    },
  },
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
