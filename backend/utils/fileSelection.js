const getUploadedAtTime = (file) => {
    const time = Date.parse(file?.uploaded_at || '');
    return Number.isNaN(time) ? 0 : time;
};

const sortFilesByUploadedAtDesc = (files) => {
    return [...files].sort((a, b) => getUploadedAtTime(b) - getUploadedAtTime(a));
};

const filterFilesForForm = (files, formCode) => {
    return files.filter((file) => file.form_code === formCode || file.form_code === 'general');
};

const selectLatestFilesByKey = (files) => {
    const latestByKey = new Map();

    for (const file of sortFilesByUploadedAtDesc(files)) {
        if (!latestByKey.has(file.file_key)) {
            latestByKey.set(file.file_key, file);
        }
    }

    return Array.from(latestByKey.values());
};

const findFilesByKeyAndForm = (files, fileKey, formCode) => {
    return files.filter((file) => file.file_key === fileKey && file.form_code === formCode);
};

module.exports = {
    filterFilesForForm,
    findFilesByKeyAndForm,
    getUploadedAtTime,
    selectLatestFilesByKey,
    sortFilesByUploadedAtDesc
};
