const User = require("../models/user.model");
const Chat = require("../models/chatMessage.model");
const Session = require("../models/chatSession.model");
const DemoSession = require("../models/DemoSession.model");

const handeleAdminDashboardDataGetRequest = async (req, res) => {
  try {

 const [
      totalUsers,
      totalAdmins,
      totalChats,
      totalUserChats,
      totalAssistantChats,
      totalSessions,
      totalDemoSessions,
      totalLikes,
      totalDislikes,
      adminData
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "admin" }),
      Chat.countDocuments(),
      Chat.countDocuments({ role: "user" }),
      Chat.countDocuments({ role: "assistant" }),
      Session.countDocuments(),
      DemoSession.countDocuments(),
      Chat.countDocuments({ feedback: "like" }),
      Chat.countDocuments({ feedback: "dislike" }),
      User.find({ role: "admin" }).select("fullname email role")
    ]);

    res.status(200).json({
      isSuccess: true,
      message: "Admin dashboard data fetched successfully",
      content: {
        totalUsers,
        totalChats,
        totalSessions,
        totalDemoSessions,
        totalLikes,
        totalDislikes,
        totalUserChats,
        totalAssistantChats,
        totalAdmins,
        adminData
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      isSuccess: false,
      message: "Internal server error",
      content: null,
    });
  }
};

module.exports = {
  handeleAdminDashboardDataGetRequest,
};
