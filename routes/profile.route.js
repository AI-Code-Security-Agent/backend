const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profile.controller");
const { authenticateToken } = require("../auth/authToken");

router.get(
  "/profile_data",
  authenticateToken,
  profileController.handleGetProfileData
);

module.exports = router;
