const DEFAULT_PFS_V2_ENABLED = false;
const DEFAULT_PFS_V2_HANDSHAKE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PFS_V2_CURVE = 'x25519';

const isPfsV2Enabled = () =>
    String(process.env.PFS_V2_ENABLED ?? String(DEFAULT_PFS_V2_ENABLED)).toLowerCase() === 'true';

const getPfsV2HandshakeTtlMs = () => {
    const parsed = Number.parseInt(String(process.env.PFS_V2_HANDSHAKE_TTL_MS || DEFAULT_PFS_V2_HANDSHAKE_TTL_MS), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PFS_V2_HANDSHAKE_TTL_MS;
};

const getPfsV2Curve = () => {
    const normalized = String(process.env.PFS_V2_CURVE || DEFAULT_PFS_V2_CURVE).trim().toLowerCase();
    return normalized || DEFAULT_PFS_V2_CURVE;
};

module.exports = {
    isPfsV2Enabled,
    getPfsV2HandshakeTtlMs,
    getPfsV2Curve
};
