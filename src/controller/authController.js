const createError = require("http-errors");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { findEmail, insert, checkIdUser, activate, resetPassword } = require("../models/users");
const { response } = require("../helper/response");
const { sendEmail, forgotPassword } = require('../helper/mail')
const jwt = require("jsonwebtoken");
const authHelper = require("../middleware/auth");

const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const { rowCount } = await findEmail(email);

    const salt = bcrypt.genSaltSync(8);
    const hashPassword = bcrypt.hashSync(password, salt);

    if (rowCount) {
      return next(createError(403, "email already exist"));
    }

    const data = {
      id: uuidv4(),
      email,
      password: hashPassword,
      name,
      isActive: false
    };
    await insert(data);
    sendEmail(data);
    response(res, data, 201, "you are successfully registered");
  } catch (error) {
    console.log(error);
    next(new createError.InternalServerError());
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows: [user] } = await findEmail(email);
    // const user = rows[0]
    if (!user) {
      return response(res, null, 403, "email or password is incorrect");
    }
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return response(res, null, 403, "email or password is incorrect");
    }
    delete user.password;

    const payload = {
      email: user.email,
      name: user.name,
      id: user.id
    };

    // generate token
    user.token = authHelper.generateToken(payload);
    user.refreshToken = authHelper.gerateRefreshToken(payload);

    response(res, user, 201, "anda berhasil login");
  } catch (error) {
    console.log(error);
    next(new createError.InternalServerError());
  }
};

const refreshToken = (req, res) => {
  const refreshToken = req.body.refreshToken;
  const decoded = jwt.verify(refreshToken, process.env.SECRET_KEY_JWT);
  const payload = {
    email: decoded.email,
    id: decoded.id
  };
  const result = {
    token: authHelper.generateToken(payload),
    refreshToken: authHelper.gerateRefreshToken(payload)
  };
  response(res, result, 200, "you are successfully logged in");
};

const forgetPassword = async (req, res, next) => {
  try {
    const { email } = req.body
    const data = {
      email
    }
    const { rows: [user] } = await findEmail(email);
    console.log(user.email);
    if (!user) {
      next(createError[400]('Email doesn\'t exist'))
    } else {
      await forgotPassword(data)
      res.status(200).json({
        message: 'check your email'
      })
    }
  } catch (error) {
    console.log(error);
    next(createError[500]('internal server error'))
  }
}

const activation = async (req, res, next) => {
  try {
    // const token = req.params.token
    const id = req.params.id
    const strId = id.toString()
    console.log("id => ",strId);
    const { rowCount: user } = await checkIdUser(strId)
    console.log(user);
    await activate(id)
    res.redirect('')
  } catch (error) {
    console.log(error);
    next(createError[500]('Something Wrong'))
  }

}

const resetPass = async (req, res, next) => {
  try {
    const { email } = jwt.verify(req.params.token, process.env.SECRET_KEY_JWT)
    console.log(email);
    const { rowCount: [user] } = await findEmail(email)
    if (user) {
      const route = 'users'
      console.log(route);
      const { password } = req.body
      const salt = bcrypt.genSaltSync(10)
      const hash = bcrypt.hashSync(password, salt)
      await resetPassword(route, hash, email)
      res.status(200).json({
        message: 'password updated'
      })
    } else {
      res.status(400).json({
        message: 'Account doesn\'t exist'
      })
    }
  } catch (error) {
    console.log(error);
    next(createError[500]('somethong\'s wrong'))
  }
}

module.exports = {
  register,
  login,
  refreshToken,
  forgetPassword,
  activation,
  resetPass,
};