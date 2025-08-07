const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const logger = require('./logger');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = path.join(uploadsDir, file.fieldname);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    cb(null, subDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'csvFile': ['.csv', '.txt'],
    'attachments': ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.jpg', '.jpeg', '.png', '.gif']
  };

  const fieldAllowedTypes = allowedTypes[file.fieldname] || [];
  const ext = path.extname(file.originalname).toLowerCase();

  if (fieldAllowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not allowed for field ${file.fieldname}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files
  }
});

class FileUploadService {
  // Middleware for CSV file upload
  uploadCsvFile() {
    return upload.single('csvFile');
  }

  // Middleware for multiple attachments
  uploadAttachments() {
    return upload.array('attachments', 10);
  }

  // Parse CSV file and extract email data
  async parseCsvFile(filePath, options = {}) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let lineNumber = 0;

      const {
        emailColumn = 'email',
        nameColumn = 'name',
        firstNameColumn = 'firstName',
        lastNameColumn = 'lastName',
        customColumns = []
      } = options;

      fs.createReadStream(filePath)
        .pipe(csv({
          skipEmptyLines: true,
          trim: true
        }))
        .on('headers', (headers) => {
          logger.info(`CSV headers detected: ${headers.join(', ')}`);
          
          // Validate required columns
          if (!headers.includes(emailColumn)) {
            reject(new Error(`Email column '${emailColumn}' not found in CSV headers`));
            return;
          }
        })
        .on('data', (row) => {
          lineNumber++;
          
          try {
            const email = row[emailColumn]?.trim();
            
            if (!email) {
              errors.push({
                line: lineNumber,
                error: 'Missing email address',
                data: row
              });
              return;
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
              errors.push({
                line: lineNumber,
                error: 'Invalid email format',
                email,
                data: row
              });
              return;
            }

            // Build recipient object
            const recipient = { email };

            // Add name fields if available
            if (nameColumn && row[nameColumn]) {
              recipient.name = row[nameColumn].trim();
            }
            if (firstNameColumn && row[firstNameColumn]) {
              recipient.firstName = row[firstNameColumn].trim();
            }
            if (lastNameColumn && row[lastNameColumn]) {
              recipient.lastName = row[lastNameColumn].trim();
            }

            // Add custom data
            const customData = {};
            customColumns.forEach(column => {
              if (row[column]) {
                customData[column] = row[column].trim();
              }
            });

            // Add all extra columns as custom data
            Object.keys(row).forEach(key => {
              if (![emailColumn, nameColumn, firstNameColumn, lastNameColumn].includes(key) && row[key]) {
                customData[key] = row[key].trim();
              }
            });

            if (Object.keys(customData).length > 0) {
              recipient.customData = customData;
            }

            results.push(recipient);

          } catch (error) {
            errors.push({
              line: lineNumber,
              error: error.message,
              data: row
            });
          }
        })
        .on('end', () => {
          logger.info(`CSV parsing completed: ${results.length} valid records, ${errors.length} errors`);
          
          resolve({
            recipients: results,
            errors,
            summary: {
              totalLines: lineNumber,
              validRecords: results.length,
              errorCount: errors.length,
              successRate: lineNumber > 0 ? ((results.length / lineNumber) * 100).toFixed(2) : 0
            }
          });
        })
        .on('error', (error) => {
          logger.error('CSV parsing error:', error);
          reject(error);
        });
    });
  }

  // Process uploaded attachments
  processAttachments(files) {
    if (!files || files.length === 0) {
      return [];
    }

    return files.map(file => ({
      filename: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date().toISOString()
    }));
  }

  // Clean up uploaded files
  async cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.info(`File deleted: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to delete file ${filePath}:`, error);
    }
  }

  // Clean up old files
  async cleanupOldFiles(olderThanHours = 24) {
    try {
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
      
      const cleanupDirectory = async (dirPath) => {
        if (!fs.existsSync(dirPath)) return;
        
        const files = await fs.promises.readdir(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = await fs.promises.stat(filePath);
          
          if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
            await this.cleanupFile(filePath);
          }
        }
      };

      // Clean up CSV files
      await cleanupDirectory(path.join(uploadsDir, 'csvFile'));
      
      // Clean up attachments
      await cleanupDirectory(path.join(uploadsDir, 'attachments'));
      
      logger.info(`Cleanup completed for files older than ${olderThanHours} hours`);
    } catch (error) {
      logger.error('File cleanup error:', error);
    }
  }

  // Get file info
  getFileInfo(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath);
      
      return {
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: ext,
        exists: true
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }

  // Validate file size and type
  validateFile(file, maxSize = 10 * 1024 * 1024, allowedTypes = []) {
    const errors = [];

    if (file.size > maxSize) {
      errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds limit (${(maxSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    if (allowedTypes.length > 0) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedTypes.includes(ext)) {
        errors.push(`File type ${ext} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new FileUploadService();
