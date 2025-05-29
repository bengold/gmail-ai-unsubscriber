import { Router } from 'express';
import { EmailController } from '../controllers/emailController';

const router = Router();
const emailController = new EmailController();

// OAuth callback route
router.get('/callback', emailController.handleCallback.bind(emailController));

export { router as authRoutes };
