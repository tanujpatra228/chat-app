const { Router } = require("express");
const authService = require("../services/auth.service");
const validate = require("../middleware/validate");
const {
  registerSchema,
  loginSchema,
} = require("../validators/auth.validator");

const router = Router();

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
