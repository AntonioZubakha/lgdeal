const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Generates an XLSX report from detailed product processing list.
 * @param {Array<Object>} detailedProductList - Array of objects with product processing details.
 * @param {string} identifier - Company name or ID for naming the report.
 * @returns {string} - The path to the generated XLSX file.
 */
const generateProductReportXlsx = (detailedProductList, identifier) => {
  try {
    const reportDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `product_import_report_${identifier.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.xlsx`;
    const filePath = path.join(reportDir, fileName);

    const reportDataForSheet = detailedProductList.map(item => {
      // Extract key fields from sourceProduct, handling cases where it might be null or missing fields
      const source = item.sourceProduct || {};
      const final = item.finalData || {};

      // Define a set of common original keys to display, more can be added
      const commonKeys = [
        'id', 'stock_no', 'stock number', 'stock #', 'ref_no', // Original IDs
        'certificateNumber', 'report_no', 'report #', 'cert_no', 'certificate_number',
        'certificateInstitute', 'lab',
        'shape', 'carat', 'color', 'clarity', 'cut', 'polish', 'symmetry', 'price', 'pricePerCarat', 'photo', 'video',
        'measurements', 'measurement1', 'measurement2', 'measurement3',
        // Add any other frequently used original field names from COLUMN_MAPPINGS if needed
      ];
      
      const originalDataDisplay = {};
      commonKeys.forEach(key => {
        let value = productUtils.getFieldValue(source, key, productUtils.COLUMN_MAPPINGS[key] || []);
        if (value !== null && value !== undefined && value !== '') {
            originalDataDisplay[`Original ${key}`] = value;
        }
      });
       if (Object.keys(originalDataDisplay).length === 0 && source) { // Fallback for unmapped source
         Object.keys(source).forEach(key => {
            originalDataDisplay[`Original ${key}`] = source[key];
         });
       }

      return {
        'Processing Status': item.status,
        'Skip Reason / Error': item.reason || 'N/A',
        'System ID (Product.id)': item.systemId || 'N/A',
        ...originalDataDisplay, // Spread original data fields
        // Optionally, add fields from finalData if status is Created/Updated
        'Final Shape': final.shape,
        'Final Carat': final.carat,
        'Final Color': final.color,
        'Final Clarity': final.clarity,
        'Final Price': final.price,
        'Final Photo URL': final.photo,
        'Final Video URL': final.video,
        'Final Certificate No.': final.certificateNumber,
        'Final Certificate Inst.': final.certificateInstitute,
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(reportDataForSheet);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Import Report');

    xlsx.writeFile(workbook, filePath);

    console.log(`[Report Generated] Successfully created XLSX report: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`[Report Generation Error] Failed to create XLSX report: ${error.message}`, error);
    throw error; // Re-throw to be handled by the caller if necessary
  }
};

// Need to require productUtils here as it's used in generateProductReportXlsx
// This might create a circular dependency if productUtils itself would require reportUtils.
// For now, assuming productUtils is self-contained or its dependencies are managed.
let productUtils;
try {
  productUtils = require('./productUtils'); 
} catch (e) {
  console.error("Failed to load productUtils in reportUtils. Report generation might be affected.", e);
  // Create a dummy productUtils if it fails to load, to prevent crashes, though report quality will suffer.
  productUtils = {
    getFieldValue: (obj, key) => obj[key],
    COLUMN_MAPPINGS: {}
  };
}


module.exports = {
  generateProductReportXlsx,
}; 