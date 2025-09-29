const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profile.controller");
const { authenticateToken } = require("../auth/authToken");

router.get("/profile_data",authenticateToken,profileController.handleGetProfileData);
router.post("/update_personal_data",authenticateToken,profileController.handleUpdatePersonalData);
router.post("/update_password",authenticateToken,profileController.handleUpdatePassword);
router.post("/update_profile_picture",authenticateToken,profileController.handleProfilePictureUpload);

// Scoped middleware ONLY for this route (20MB limit)
// router.post(
//   "/update_profile_picture",
//   authenticateToken,
//   express.json({ limit: "50mb" }),
//   express.urlencoded({ limit: "50mb", extended: true }),
//   profileController.handleProfilePictureUpload
// );

module.exports = router;
