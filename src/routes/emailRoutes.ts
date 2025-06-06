import { Router } from 'express';
import { EmailController } from '../controllers/emailController';

const router = Router();
const emailController = new EmailController();

router.get('/auth-url', emailController.getAuthUrl.bind(emailController));
router.get('/auth-status', emailController.checkAuthStatus.bind(emailController));
router.post('/authenticate', emailController.authenticate.bind(emailController));
router.post('/scan', emailController.scanJunkEmails.bind(emailController));
router.post('/scan-more', emailController.scanMoreEmails.bind(emailController));
router.get('/progress', emailController.getProgress.bind(emailController));
router.post('/unsubscribe', emailController.unsubscribeFromSender.bind(emailController));
router.post('/unsubscribe-enhanced', emailController.enhancedUnsubscribe.bind(emailController));
router.post('/bulk-unsubscribe-enhanced', emailController.enhancedBulkUnsubscribe.bind(emailController));
router.post('/test-computer-use', emailController.testComputerUse.bind(emailController));
router.post('/skip', emailController.skipSender.bind(emailController));
router.get('/skip-list', emailController.getSkippedSenders.bind(emailController));
router.delete('/skip', emailController.removeFromSkipList.bind(emailController));

export { router as emailRoutes };