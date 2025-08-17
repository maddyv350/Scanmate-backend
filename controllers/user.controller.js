const UserService = require('../services/user.service');

class UserController {
  // Block a user
  async blockUser(req, res) {
    try {
      const userId = req.user.userId;
      const { userToBlockId } = req.body;

      if (!userToBlockId) {
        return res.status(400).json({
          success: false,
          message: 'User ID to block is required'
        });
      }

      const result = await UserService.blockUser(userId, userToBlockId);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Unblock a user
  async unblockUser(req, res) {
    try {
      const userId = req.user.userId;
      const { userToUnblockId } = req.body;

      if (!userToUnblockId) {
        return res.status(400).json({
          success: false,
          message: 'User ID to unblock is required'
        });
      }

      const result = await UserService.unblockUser(userId, userToUnblockId);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get blocked users
  async getBlockedUsers(req, res) {
    try {
      const userId = req.user.userId;
      const blockedUsers = await UserService.getBlockedUsers(userId);
      
      res.json({
        success: true,
        data: blockedUsers
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Report a user
  async reportUser(req, res) {
    try {
      const userId = req.user.userId;
      const { 
        reportedUserId, 
        reason, 
        description = '', 
        evidence = [], 
        chatRoomId = null, 
        messageId = null 
      } = req.body;

      if (!reportedUserId || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Reported user ID and reason are required'
        });
      }

      const result = await UserService.reportUser(
        userId, 
        reportedUserId, 
        reason, 
        description, 
        evidence, 
        chatRoomId, 
        messageId
      );
      
      res.json({
        success: true,
        message: result.message,
        data: { reportId: result.reportId }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Check if user is blocked
  async isUserBlocked(req, res) {
    try {
      const userId = req.user.userId;
      const { otherUserId } = req.params;

      if (!otherUserId) {
        return res.status(400).json({
          success: false,
          message: 'Other user ID is required'
        });
      }

      const isBlocked = await UserService.isUserBlocked(userId, otherUserId);
      
      res.json({
        success: true,
        data: { isBlocked }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get reports for a user (admin only)
  async getReportsForUser(req, res) {
    try {
      const { userId } = req.params;
      const reports = await UserService.getReportsForUser(userId);
      
      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get all reports (admin only)
  async getAllReports(req, res) {
    try {
      const { status } = req.query;
      const reports = await UserService.getAllReports(status);
      
      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update report status (admin only)
  async updateReportStatus(req, res) {
    try {
      const { reportId } = req.params;
      const { status, adminNotes = '' } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const result = await UserService.updateReportStatus(reportId, status, adminNotes);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new UserController();