const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profile.controller");
const { authenticateToken } = require("../auth/authToken");

router.get("/profile_data",authenticateToken,profileController.handleGetProfileData);
router.post("/update_personal_data",authenticateToken,profileController.handleUpdatePersonalData);
router.post("/update_password",authenticateToken,profileController.handleUpdatePassword);
  


module.exports = router;
