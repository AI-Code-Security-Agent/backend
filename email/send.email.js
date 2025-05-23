const nodemailer = require('nodemailer');
const name = 'sendEmail';
const {SEND_MAIL_CONFIG} = require('../config/send.email.config');

const transporter = nodemailer.createTransport(SEND_MAIL_CONFIG);

const emailSender = async(email,link)=> {
    try {

      let mailDetails = {
        from: SEND_MAIL_CONFIG.auth.user,
        to: `${email}`,
        subject: 'Test mail',
        html: `${link}`
      };
      let info = await transporter.sendMail(mailDetails);
      console.log(info);
      return info;

      } catch (error) {
        console.log(error);
        return false;
      }
}

module.exports = emailSender;