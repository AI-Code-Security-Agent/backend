const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const jwt = require("jsonwebtoken"); // <- add this
const passport = require("passport");
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Start Google login
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

// Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}/login?error=google`,
  }),
  (req, res) => {
    console.log("req.user:", req.user);
    const token = jwt.sign(
      { id: req.user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "24h" }
    );

    const redirectUrl = `${FRONTEND_URL}/login?accessToken=${encodeURIComponent(
      token
    )}&username=${encodeURIComponent(
      req.user.firstname || req.user.name || ""
    )}`;
    res.redirect(redirectUrl);
  }
);

// login post request
router.post("/login", authController.handleLogin);

// logout post request
router.post("/logout", (req, res, next) => {
  req.logOut((err) => {
    if (err) {
      return next(err);
    }

    // Destroy session completely
    req.session.destroy((err) => {
      if (err) {
        console.log("Session destruction error:", err);
      }
      // Clear cookie on client side
      res.clearCookie("connect.sid", { path: "/" });

      //       res.clearCookie("connect.sid", {
      //   path: "/",
      //   httpOnly: true,
      //   secure: process.env.NODE_ENV === "production", // false on localhost
      //   sameSite: "lax",
      // });

      res.json({
        isSuccess: true,
        message: "Successfully logged out!",
      });
    });
  });
});

// Endpoint for forgot password
router.post("/forgotPassword", authController.handleForgotPasswordPostRequest);

// Endpoint for reset password
router.get(
  "/verifyResetAccess",
  authController.handleResetPasswordVerificationGetRequest
);
router.post("/resetPassword", authController.handleResetPasswordPostRequest);

module.exports = router;
