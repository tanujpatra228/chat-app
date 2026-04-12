const { Router } = require("express");
const userService = require("../services/user.service");

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const users = await userService.searchUsers(
      req.query.q,
      req.user.userId
    );
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const profile = await userService.getPublicProfile(req.params.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
