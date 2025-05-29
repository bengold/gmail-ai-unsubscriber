"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const emailController_1 = require("../controllers/emailController");
const router = (0, express_1.Router)();
exports.authRoutes = router;
const emailController = new emailController_1.EmailController();
// OAuth callback route
router.get('/callback', emailController.handleCallback.bind(emailController));
