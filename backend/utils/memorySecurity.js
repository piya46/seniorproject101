const wipeBuffer = (value) => {
    if (!Buffer.isBuffer(value)) {
        return;
    }

    value.fill(0);
};

const wipeBufferList = (values = []) => {
    for (const value of values) {
        wipeBuffer(value);
    }
};

module.exports = {
    wipeBuffer,
    wipeBufferList
};
