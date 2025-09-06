import { v4 as uuidv4 } from 'uuid'

export interface Invitation {
  token: string
  email: string
  organizationId: string
  role: string
  inviterName: string
  inviterEmail: string
  createdAt: string
  expiresAt: string
  status: 'pending' | 'accepted' | 'expired'
}

class InvitationService {
  private invitations: Map<string, Invitation> = new Map()

  generateInvitationToken(): string {
    return uuidv4()
  }

  createInvitation(data: {
    email: string
    organizationId: string
    role: string
    inviterName: string
    inviterEmail: string
  }): Invitation {
    const token = this.generateInvitationToken()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invitation: Invitation = {
      token,
      email: data.email,
      organizationId: data.organizationId,
      role: data.role,
      inviterName: data.inviterName,
      inviterEmail: data.inviterEmail,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending'
    }

    this.invitations.set(token, invitation)
    return invitation
  }

  getInvitation(token: string): Invitation | null {
    const invitation = this.invitations.get(token)
    if (!invitation) return null

    // Check if invitation has expired
    if (new Date() > new Date(invitation.expiresAt)) {
      invitation.status = 'expired'
      this.invitations.set(token, invitation)
    }

    return invitation
  }

  acceptInvitation(token: string): Invitation | null {
    const invitation = this.getInvitation(token)
    if (!invitation || invitation.status !== 'pending') {
      return null
    }

    invitation.status = 'accepted'
    this.invitations.set(token, invitation)
    return invitation
  }

  isValidInvitation(token: string): boolean {
    const invitation = this.getInvitation(token)
    return invitation !== null && invitation.status === 'pending'
  }

  getInvitationsByEmail(email: string): Invitation[] {
    return Array.from(this.invitations.values())
      .filter(invitation => invitation.email === email)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  getInvitationsByOrganization(organizationId: string): Invitation[] {
    return Array.from(this.invitations.values())
      .filter(invitation => invitation.organizationId === organizationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  revokeInvitation(token: string): boolean {
    const invitation = this.invitations.get(token)
    if (!invitation) return false

    invitation.status = 'expired'
    this.invitations.set(token, invitation)
    return true
  }

  cleanupExpiredInvitations(): number {
    const now = new Date()
    let cleanedUp = 0

    for (const [token, invitation] of this.invitations.entries()) {
      if (new Date(invitation.expiresAt) < now && invitation.status === 'pending') {
        invitation.status = 'expired'
        this.invitations.set(token, invitation)
        cleanedUp++
      }
    }

    return cleanedUp
  }

  // Get invitation statistics
  getInvitationStats(organizationId?: string): {
    total: number
    pending: number
    accepted: number
    expired: number
  } {
    let invitations = Array.from(this.invitations.values())
    
    if (organizationId) {
      invitations = invitations.filter(inv => inv.organizationId === organizationId)
    }

    return {
      total: invitations.length,
      pending: invitations.filter(inv => inv.status === 'pending').length,
      accepted: invitations.filter(inv => inv.status === 'accepted').length,
      expired: invitations.filter(inv => inv.status === 'expired').length
    }
  }

  // Get all invitations (for master users)
  getAllInvitations(): Invitation[] {
    return Array.from(this.invitations.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  // Resend invitation (extends expiration)
  resendInvitation(token: string): Invitation | null {
    const invitation = this.invitations.get(token)
    if (!invitation) return null

    // Only resend if invitation is pending or expired
    if (invitation.status === 'accepted') {
      return null
    }

    // Extend expiration by 7 days from now
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

    invitation.expiresAt = expiresAt.toISOString()
    invitation.status = 'pending' // Reset to pending if it was expired

    this.invitations.set(token, invitation)
    return invitation
  }
}

// Singleton instance
export const invitationService = new InvitationService()
export default invitationService