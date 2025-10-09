import { Router } from 'express';
import {
  createAgreement,
  getAgreement,
  prepareAgreementSignature,
  confirmAgreementSignature,
  verifyAgreement,
  markAgreementSettled,
} from '../../controllers/agreements.controller.js';

const router = Router();

router.post('/', createAgreement);
router.get('/:id', getAgreement);
router.post('/:id/prepare-sign', prepareAgreementSignature);
router.post('/:id/confirm', confirmAgreementSignature);
router.post('/:id/verify', verifyAgreement);
router.post('/:id/settlement', markAgreementSettled);

export default router;
