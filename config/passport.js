const LocalStratergy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user.model");
const bcrypt = require("bcryptjs");

module.exports = function (passport) {
  passport.use(
    new LocalStratergy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        // user matching
        const userResponse = await User.findOne({ email: email });
        if (!userResponse) {
          return done(null, false, {
            message: " Please check your email again.",
          });
        }

        // password matching
        const isMatch = await bcrypt.compare(password, userResponse.password);
        if (isMatch) {
          return done(null, userResponse);
        } else {
          return done(null, false, { message: "Invalid Password.!" });
        }
      }
    )
  );

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // If no user with this Google ID, check if email already exists
          const existingEmailUser = await User.findOne({
            email: profile.emails[0].value,
          });
          if (existingEmailUser) {;
            await existingEmailUser.save();
            return done(null, existingEmailUser);
          }

          // Create new user
          const newUser = new User({
            email: profile.emails[0].value,
            firstname: profile.displayName,
            password: null, // no password for Google login
          });

          await newUser.save();
          return done(null, newUser);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

  // serialization & deserialization
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      console.log(err);
      done(err, false);
    }
  });
};
