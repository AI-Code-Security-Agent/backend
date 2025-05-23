const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const bodyParser = require("body-parser");
require("dotenv").config();
const env = process.env.NODE_ENV || "development";
const config = require("./config/config.json")[env];
const MONGO_URI = config.MongoURI;


app.use(bodyParser.json());

app.use( 
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware to parse URL-encoded data
app.use(express.urlencoded({ extended: true }));

// Session middleware setup
app.use(
    session({
      secret: "defaultSecretKey",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 10 * 60 * 60 * 1000,
      },
    })
);

// Passport Configuration
app.use(passport.initialize());
app.use(passport.session());
require("./config/passport")(passport);

//Database connection
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected!");
  })
  .catch((err) => console.error("MongoDB connection error:", err));

app.use('/users', require('./routes/user.route'));
app.use("/auth", require('./routes/auth.route'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Server is running at port 4000");
});