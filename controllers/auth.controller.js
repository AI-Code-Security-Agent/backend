const passport = require("passport");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");

const handleLogin = (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(200).json({
        isSuccess: false,
        message: info.message,
      });
    }

    req.login(user, async (err) => {
      if (err) {
        return next(err);
      }

      try {
        const userId = { id: user._id };
        const accessToken = jwt.sign(userId, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "24",
        });

        return res.status(200).json({
          isSuccess: true,
          message: "Logged in Successfully!",
          accessToken: accessToken,
          username: user.firstname,
        });
      } catch (err) {
        console.error("Error generating JWT :", err);
        return res.status(500).json({
          isSuccess: false,
          message: "Error with generating token.",
        });
      }
    });
  })(req, res, next);
};

const handleForgotPasswordPostRequest = async (req, res) => {
  try {

    
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
  handleLogin,
};
