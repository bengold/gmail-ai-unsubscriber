"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUnsubscribeRoutes = void 0;
const express_1 = require("express");
const unsubscribeController_1 = require("../controllers/unsubscribeController");
const router = (0, express_1.Router)();
const unsubscribeController = new unsubscribeController_1.UnsubscribeController();
function setUnsubscribeRoutes(app) {
    app.post('/unsubscribe', unsubscribeController.unsubscribeEmail.bind(unsubscribeController));
    app.get('/unsubscribe/status', unsubscribeController.getUnsubscribeStatus.bind(unsubscribeController));
}
exports.setUnsubscribeRoutes = setUnsubscribeRoutes;
