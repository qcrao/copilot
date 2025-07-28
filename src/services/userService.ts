// src/services/userService.ts
import { RoamService } from './roamService';

interface UserInfo {
  name: string;
  email?: string;
  avatar?: string;
}

export class UserService {
  private static userInfoCache: UserInfo | null = null;

  /**
   * Get user information from various sources
   */
  static async getUserInfo(): Promise<UserInfo> {
    if (this.userInfoCache) {
      return this.userInfoCache;
    }

    const userInfo: UserInfo = {
      name: 'You',
      email: undefined,
      avatar: undefined
    };

    try {
      // Try to get from Roam graph name first
      const graphName = RoamService.getCurrentGraphName();
      if (graphName) {
        userInfo.name = this.formatUserName(graphName);
      }

      // Try to get from Roam API if available
      if (window.roamAlphaAPI && (window.roamAlphaAPI as any).user) {
        try {
          const roamUser = (window.roamAlphaAPI as any).user;
          if (roamUser.email) {
            userInfo.email = roamUser.email;
          }
          if (roamUser.displayName) {
            userInfo.name = roamUser.displayName;
          }
        } catch (error) {
          console.log('Could not get user info from Roam API:', error);
        }
      }

      // Try to get from document or other sources
      if (!userInfo.email) {
        // Check if there's a user email in localStorage or other storage
        const savedEmail = localStorage.getItem('roam-user-email');
        if (savedEmail) {
          userInfo.email = savedEmail;
        }
      }

      this.userInfoCache = userInfo;
    } catch (error) {
      console.error('Error getting user info:', error);
    }

    return userInfo;
  }

  /**
   * Format graph name to a readable user name
   */
  private static formatUserName(graphName: string): string {
    // Remove URL encoding
    let name = decodeURIComponent(graphName);
    
    // Replace underscores and hyphens with spaces
    name = name.replace(/[_-]/g, ' ');
    
    // Capitalize first letter of each word
    name = name.replace(/\b\w/g, l => l.toUpperCase());
    
    return name || 'You';
  }

  /**
   * Get user avatar URL
   */
  static async getUserAvatar(): Promise<string> {
    const userInfo = await this.getUserInfo();
    
    if (userInfo.avatar) {
      return userInfo.avatar;
    }

    // Try Gravatar if we have email
    if (userInfo.email) {
      return this.getGravatarUrl(userInfo.email);
    }

    // Generate initials avatar
    return this.generateInitialsAvatar(userInfo.name);
  }

  /**
   * Get Gravatar URL for email
   */
  private static getGravatarUrl(email: string): string {
    const emailHash = this.md5(email.toLowerCase().trim());
    return `https://www.gravatar.com/avatar/${emailHash}?d=identicon&s=64`;
  }

  /**
   * Generate initials avatar data URL
   */
  private static generateInitialsAvatar(name: string): string {
    const initials = this.getInitials(name);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return this.getDefaultAvatarDataUrl();
    }

    canvas.width = 64;
    canvas.height = 64;

    // Background color based on name
    ctx.fillStyle = "#3A3B40";
    ctx.fillRect(0, 0, 64, 64);
    
    // Text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 32, 32);
    
    return canvas.toDataURL();
  }

  /**
   * Get initials from name
   */
  private static getInitials(name: string): string {
    if (!name) return 'U';
    
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * Get default avatar data URL
   */
  private static getDefaultAvatarDataUrl(): string {
    const svg = `
      <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="32" fill="#393a3d"/>
        <circle cx="32" cy="24" r="8" fill="white"/>
        <path d="M16 56 C16 48, 22 42, 32 42 C42 42, 48 48, 48 56 Z" fill="white"/>
      </svg>
    `;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  /**
   * Simple MD5 implementation for Gravatar
   */
  private static md5(str: string): string {
    // Simple hash function for demo - in production, use a proper MD5 library
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Clear user info cache
   */
  static clearCache(): void {
    this.userInfoCache = null;
  }
}