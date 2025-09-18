const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { authenticateToken } = require("../auth/authToken");

router.get("/dashboard", adminController.handeleAdminDashboardDataGetRequest);

module.exports = router;