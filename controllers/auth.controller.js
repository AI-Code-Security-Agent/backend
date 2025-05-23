const passport = require("passport");
const { v4: uuidv4 } = require("uuid");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const ForgotPassword = require("../models/forgotPassword.model");
const path = require("path");
require("dotenv").config(path.join(__dirname, "..", ".env"));
const env = process.env.NODE_ENV || "development";
const config = require(path.join(__dirname, "..", "config", "config.json"))[
  env
];
const emailService = require("../email");
const jwt = require("jsonwebtoken");

const getHTMLEmail = (link) => {
  return `<!DOCTYPE html>
    <html lang="en-US">
      <head>
        <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
        <meta name="description" content="New Account Email Template." />
        <style type="text/css">
          a:hover {
            text-decoration: underline !important;
          }
    
          .body {
            margin: 0px;
            background-color: #f2f3f8;
          }
    
          .table1 {
            background-color: #f2f3f8;
            max-width: 670px;
            margin: 0 auto;
          }
          body {
            @import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700);
            font-family: "Open Sans", sans-serif;
          }
          .tb2 {
            max-width: 670px;
            background: #fff;
            border-radius: 3px;
            text-align: center;
            -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
            -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
            box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
          }
          .h1 {
            color: #1e1e2d;
            font-weight: 500;
            margin: 0;
            font-size: 32px;
            font-family: "Rubik", sans-serif;
          }
          .p1 {
            font-size: 15px;
            color: #455056;
            margin: 8px 0 0;
            line-height: 24px;
          }
          .p2 {
            color: #455056;
            font-size: 18px;
            line-height: 20px;
            margin: 0;
            font-weight: 500;
          }
          .p3 {
            font-size: 14px;
            color: rgba(69, 80, 86, 0.7411764705882353);
            line-height: 18px;
            margin: 0 0 0;
          }
          .s1 {
            display: inline-block;
            vertical-align: middle;
            margin: 29px 0 26px;
            border-bottom: 1px solid #cecece;
            width: 100px;
          }
          .st1 {
            display: block;
            font-size: 13px;
            margin: 0 0 4px;
            color: rgba(0, 0, 0, 0.64);
            font-weight: normal;
          }
          .st2 {
            display: block;
            font-size: 13px;
            margin: 24px 0 4px 0;
            font-weight: normal;
            color: rgba(0, 0, 0, 0.64);
          }
          .logo {
            background: #ff96d5;
            background: linear-gradient(90deg, #99c8f1 35%, #c686e3 100%);
            text-decoration: none !important;
            display: inline-block;
            font-weight: 500;
            margin-top: 24px;
            color: #fff;
            text-transform: uppercase;
            font-size: 14px;
            padding: 10px 24px;
            display: inline-block;
            border-radius: 50px;
          }
        </style>
      </head>
    
      <body
        marginheight="0"
        topmargin="0"
        marginwidth="0"
        class="body"
        leftmargin="0"
      >
        <table
          cellspacing="0"
          border="0"
          cellpadding="0"
          width="100%"
          bgcolor="#f2f3f8"
        >
          <tr>
            <td>
              <table
                width="100%"
                border="0"
                class="table1"
                align="center"
                cellpadding="0"
                cellspacing="0"
              >
                <tr>
                  <td style="height: 80px"> </td>
                </tr>
                <tr>
                  <td style="text-align: center">
                  </td>
                </tr>
                <tr>
                  <td style="height: 20px"> </td>
                </tr>
                <tr>
                  <td>
                    <table
                      width="95%"
                      border="0"
                      align="center"
                      cellpadding="0"
                      cellspacing="0"
                      class="tb2"
                    >
                      <tr>
                        <td style="height: 40px"> </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 35px">
                          <h1 class="h1">Reset Password</h1>
                          <p class="p1">
                            You recently requested to reset your password for your account. Use the button below to reset it. This password reset is only valid for a limited time.
                            <br />
                          </p>
                          <span class="s1"></span>
                          <p class="p2">
                          </p>
    
                            <a href="${link}" class="logo">
                                Reset Password
                            </a>
                        </td>
                      </tr>
                      <tr>
                        <td style="height: 40px"> </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="height: 20px"> </td>
                </tr>
                <tr>
                  <td style="text-align: center">
                  </td>
                </tr>
                <tr>
                  <td style="height: 80px"> </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
        
    `;
};

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
    const email = req.body.email;
    const user = User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        isSuccess: false,
        message: "User not found.",
        content: null,
      });
    }

    const verificationCode = uuidv4().slice(0, 20);
    const previouseAttempt = await ForgotPassword.findOne({ email });

    if (previouseAttempt) {
      previouseAttempt.verificationCode = verificationCode;
      await previouseAttempt.save();
    } else {
      await ForgotPassword.create({ email, verificationCode });
    }

    const link = `${config["client_domain"]}/resetPassword?id=${verificationCode}&email=${email}`;
    const emailContent = getHTMLEmail(link);
    const sendEmail = await emailService.send(email, emailContent);

    if (!sendEmail) {
      return res.status(200).json({
        isSuccess: false,
        message: "Failed to send email.",
        content: null,
      });
    }

    res.status(200).json({
      isSuccess: true,
      message: "Email sent successfully. Please check your email.",
      content: {
        email: email,
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

const handleResetPasswordVerificationGetRequest = async (req, res) => {
  try {
    const verificationID = req.query.id;
    const email = req.query.email;
    const verfication = await ForgotPassword.findOne({
      email,
      verificationCode: verificationID,
    });

    if (!verfication) {
      return res.status(200).json({
        isSuccess: false,
        message: "Verification failed .",
        content: null,
      });
    }

    res.status(200).json({
      isSuccess: true,
      message: "Verification Success .",
      content: {
        verfication: verfication,
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
  handleLogin,
  handleForgotPasswordPostRequest,
  handleResetPasswordVerificationGetRequest,
  
};
