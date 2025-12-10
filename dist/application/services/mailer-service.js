"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailerService = void 0;
const mailer_1 = require("../../services/mailer");
class MailerService {
    constructor(env) {
        this.env = env;
    }
    send(options) {
        return (0, mailer_1.sendMail)(this.env, options);
    }
}
exports.MailerService = MailerService;
//# sourceMappingURL=mailer-service.js.map