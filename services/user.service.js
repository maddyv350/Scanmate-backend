const User = require('../models/user.model');
const Report = require('../models/report.model');

class UserService {
  // Block a user
  static async blockUser(userId, userToBlockId) {
    try {
      // Check if users exist
      const user = await User.findById(userId);
      const userToBlock = await User.findById(userToBlockId);
      
      if (!user || !userToBlock) {
        throw new Error('User not found');
      }
      
      // Check if already blocked
      if (user.blockedUsers.includes(userToBlockId)) {
        throw new Error('User is already blocked');
      }
      
      // Add to blocked users
      user.blockedUsers.push(userToBlockId);
      await user.save();
      
      // Add to blockedBy for the other user
      userToBlock.blockedBy.push(userId);
      await userToBlock.save();
      
      return { success: true, message: 'User blocked successfully' };
    } catch (error) {
      throw new Error(`Failed to block user: ${error.message}`);
    }
  }
  
  // Unblock a user
  static async unblockUser(userId, userToUnblockId) {
    try {
      const user = await User.findById(userId);
      const userToUnblock = await User.findById(userToUnblockId);
      
      if (!user || !userToUnblock) {
        throw new Error('User not found');
      }
      
      // Remove from blocked users
      user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== userToUnblockId);
      await user.save();
      
      // Remove from blockedBy for the other user
      userToUnblock.blockedBy = userToUnblock.blockedBy.filter(id => id.toString() !== userId);
      await userToUnblock.save();
      
      return { success: true, message: 'User unblocked successfully' };
    } catch (error) {
      throw new Error(`Failed to unblock user: ${error.message}`);
    }
  }
  
  // Get blocked users
  static async getBlockedUsers(userId) {
    try {
      const user = await User.findById(userId).populate('blockedUsers', 'firstName lastName profilePhotoPath');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user.blockedUsers;
    } catch (error) {
      throw new Error(`Failed to get blocked users: ${error.message}`);
    }
  }
  
  // Check if user is blocked
  static async isUserBlocked(userId, otherUserId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return false;
      }
      
      return user.blockedUsers.includes(otherUserId) || user.blockedBy.includes(otherUserId);
    } catch (error) {
      return false;
    }
  }
  
  // Report a user
  static async reportUser(reporterId, reportedUserId, reason, description = '', evidence = [], chatRoomId = null, messageId = null) {
    try {
      // Check if users exist
      const reporter = await User.findById(reporterId);
      const reportedUser = await User.findById(reportedUserId);
      
      if (!reporter || !reportedUser) {
        throw new Error('User not found');
      }
      
      // Check if already reported
      const existingReport = await Report.hasBeenReportedBy(reportedUserId, reporterId);
      if (existingReport) {
        throw new Error('User has already been reported');
      }
      
      // Create report
      const report = new Report({
        reporterId,
        reportedUserId,
        reason,
        description,
        evidence,
        chatRoomId,
        messageId
      });
      
      await report.save();
      
      return { success: true, message: 'User reported successfully', reportId: report._id };
    } catch (error) {
      throw new Error(`Failed to report user: ${error.message}`);
    }
  }
  
  // Get reports for a user (admin only)
  static async getReportsForUser(userId) {
    try {
      return await Report.getReportsForUser(userId);
    } catch (error) {
      throw new Error(`Failed to get reports: ${error.message}`);
    }
  }
  
  // Get all reports (admin only)
  static async getAllReports(status = null) {
    try {
      if (status) {
        return await Report.getReportsByStatus(status);
      }
      return await Report.find()
        .populate('reporterId', 'firstName lastName email')
        .populate('reportedUserId', 'firstName lastName email')
        .sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Failed to get reports: ${error.message}`);
    }
  }
  
  // Update report status (admin only)
  static async updateReportStatus(reportId, status, adminNotes = '') {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      report.status = status;
      report.adminNotes = adminNotes;
      
      if (status === 'reviewed') {
        report.reviewedAt = new Date();
      } else if (status === 'resolved') {
        report.resolvedAt = new Date();
      }
      
      await report.save();
      
      return { success: true, message: 'Report status updated successfully' };
    } catch (error) {
      throw new Error(`Failed to update report status: ${error.message}`);
    }
  }
}

module.exports = UserService;
