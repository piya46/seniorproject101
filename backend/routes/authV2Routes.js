const express = require('express');
const router = express.Router();

const { getPfsV2Handshake, getPfsV2Status } = require('../utils/cryptoUtils');

router.get('/handshake', (req, res) => {
    const status = getPfsV2Status();

    if (!status.enabled) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'PFS protocol v2 is not enabled on this backend.'
        });
    }

    try {
        const handshake = getPfsV2Handshake();
        return res.status(200).json(handshake);
    } catch (error) {
        req.log?.error('pfs_v2_handshake_failed', { message: error.message });
        return res.status(500).json({
            error: 'Handshake Error',
            message: 'Unable to issue PFS v2 handshake metadata.'
        });
    }
});

module.exports = router;
