import bcrypt from 'bcryptjs'
import prisma from '@/lib/db/prisma'
import { User, UserRole, Prisma } from '@prisma/client'
import crypto from 'crypto'

export class UserService {
  // Find user by email (case-insensitive)
  static async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { 
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    })
  }

  // Find user by ID
  static async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id }
    })
  }

  // Validate password
  static async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  // Create new user
  static async createUser(userData: {
    email: string
    password: string
    name: string
    role: UserRole
    organizationId?: string
    phone?: string | null
    title?: string | null
    department?: string | null
  }): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10)
    
    return prisma.user.create({
      data: {
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        name: userData.name,
        role: userData.role,
        organizationId: userData.organizationId,
        phone: userData.phone || null,
        title: userData.title || null,
        department: userData.department || null,
      },
      // organization relation removed
    })
  }

  // Create session
  static async createSession(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
    
    await prisma.session.create({
      data: {
        userId,
        token,
        expiresAt,
      }
    })
    
    return token
  }

  // Validate session
  static async validateSession(token: string | undefined): Promise<User | null> {
    if (!token) {
      return null
    }
    
    const session = await prisma.session.findUnique({
      where: { token },
      include: { 
        user: {
          include: {
            organization: true
          }
        }
      }
    })
    
    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } })
      }
      return null
    }
    
    return session.user
  }

  // Update last login
  static async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    })
  }

  // Get users by role
  static async getUsersByRole(role: UserRole, organizationId?: string): Promise<User[]> {
    const where: Prisma.UserWhereInput = {
      role,
      isActive: true,
    }
    
    if (organizationId) {
      where.organizationId = organizationId
    }
    
    return prisma.user.findMany({
      where,
      // organization relation removed,
      orderBy: { name: 'asc' }
    })
  }

  // Get all users in organization
  static async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      // organization relation removed,
      orderBy: { name: 'asc' }
    })
  }

  // Update user
  static async updateUser(userId: string, updates: Prisma.UserUpdateInput): Promise<User | null> {
    // Hash password if updating
    if (updates.password && typeof updates.password === 'string') {
      updates.password = await bcrypt.hash(updates.password, 10)
    }

    return prisma.user.update({
      where: { id: userId },
      data: updates,
      // organization relation removed
    })
  }

  // Deactivate user
  static async deactivateUser(userId: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      })
      
      // Delete all sessions
      await prisma.session.deleteMany({
        where: { userId }
      })
      
      return true
    } catch (error) {
      return false
    }
  }


  // Clean up expired sessions
  static async cleanupExpiredSessions(): Promise<void> {
    await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
  }
}