const User = require("../models/user.model");
const bcryptjs = require("bcryptjs");
const emailService = require("../email");

const handleGetProfileData = async (req, res) => {
  try {
    const userId = req.user._id;
    // console.log("User ID :", userId);
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

const handleUpdatePersonalData = async (req, res) => {
  try {
   // const userId = req.user._id;
    const { fullname, email } = req.body;

    const user = await User.findOneAndUpdate(
      { email },
      { fullname, email },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        isSuccess: false,
        message: "User not found",
        content: null,
      });
    }

    res.status(200).json({
      isSuccess: true,
      message: "User updated successfully",
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

const handleUpdatePassword = async (req, res) => {
    try {
        const userId = req.user._id;
        const { newPassword } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                isSuccess: false,
                message: "User not found",
                content: null,
            });
        }

        const hashedNewPassword = await bcryptjs.hash(newPassword, 10);

        user.password = hashedNewPassword;
        await user.save();

        res.status(200).json({
            isSuccess: true,
            message: "Password updated successfully!",
            content: null,
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

// app.post("/api/profile/picture", async (req, res) => {
//   try {
//     const { profilePicture } = req.body; // base64 string

//     // Save in MongoDB
//     await User.findByIdAndUpdate(req.user.id, { profilePicture });

//     res.json({ profilePicture });
//   } catch (err) {
//     res.status(500).json({ message: "Failed to save profile picture" });
//   }
// });


const handleProfilePictureUpload = async (req, res) => {
  try {
    const userId = req.user._id;
    const { profilePicture } = req.body; // Assuming base64 string
    const user = await User.findByIdAndUpdate(
      userId,
      { profilePicture },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        isSuccess: false,
        message: "User not found",
        content: null,
      });
    } 

    res.status(200).json({
      isSuccess: true,
      message: "Profile picture updated successfully",
      content: user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      isSuccess: false,
      message: "Failed to update profile picture",
      content: null,
    });
  }
};

module.exports = {
  handleGetProfileData,
  handleUpdatePersonalData,
  handleUpdatePassword,
  handleProfilePictureUpload
};