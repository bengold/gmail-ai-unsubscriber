import { Router } from 'express';
import { EmailController } from '../controllers/emailController';

const router = Router();
const emailController = new EmailController();

router.get('/auth-url', emailController.getAuthUrl.bind(emailController));
router.post('/authenticate', emailController.authenticate.bind(emailController));
router.get('/scan', emailController.scanJunkEmails.bind(emailController));
router.get('/progress', emailController.getProgress.bind(emailController));
router.post('/unsubscribe', emailController.unsubscribeFromSender.bind(emailController));
router.post('/skip', emailController.skipSender.bind(emailController));
router.get('/skip-list', emailController.getSkippedSenders.bind(emailController));
router.delete('/skip', emailController.removeFromSkipList.bind(emailController));

export { router as emailRoutes };