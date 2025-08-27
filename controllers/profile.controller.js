const User = require("../models/user.model");
const bcryptjs = require("bcryptjs");
const emailService = require("../email");

const handleGetProfileData = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("User ID :", userId);
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        isSuccess: false,
        message: "User not found",
        content: null,
      });
    }

    // console.log("User Data :", user);

    res.status(200).json({
      isSuccess: true,
      message: "User retrieved successfully",
      content: user,
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
  handleGetProfileData
};