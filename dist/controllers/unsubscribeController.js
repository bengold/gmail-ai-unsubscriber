"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsubscribeController = void 0;
const unsubscribeService_1 = require("../services/unsubscribeService");
class UnsubscribeController {
    constructor() {
        this.unsubscribeService = new unsubscribeService_1.UnsubscribeService();
    }
    unsubscribe(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { emailId } = req.body;
                const result = yield this.unsubscribeService.unsubscribe(emailId);
                res.status(200).json({ message: 'Unsubscription successful', result });
            }
            catch (error) {
                res.status(500).json({ message: 'Unsubscription failed', error: error.message });
            }
        });
    }
}
exports.UnsubscribeController = UnsubscribeController;
