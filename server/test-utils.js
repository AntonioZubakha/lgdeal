// Simple test script for the productUtils module
const productUtils = require('./utils/productUtils');

console.log('SHAPE_MAPPING keys:', Object.keys(productUtils.SHAPE_MAPPING));
console.log('Available functions:', Object.keys(productUtils).filter(key => typeof productUtils[key] === 'function'));

// Test normalizeShape function
console.log('\nTesting normalizeShape:');
console.log('  RD -> ', productUtils.normalizeShape('RD'));
console.log('  OVAL -> ', productUtils.normalizeShape('OVAL'));
console.log('  UNKNOWN -> ', productUtils.normalizeShape('UNKNOWN'));

// Test parseMeasurements function
console.log('\nTesting parseMeasurements:');
console.log('  "7.26x7.30x4.60" -> ', productUtils.parseMeasurements('7.26x7.30x4.60'));
console.log('  "7.26 7.30 4.60" -> ', productUtils.parseMeasurements('7.26 7.30 4.60'));
console.log('  "7.26,7.30,4.60" -> ', productUtils.parseMeasurements('7.26,7.30,4.60'));

// Test getFieldValue function
console.log('\nTesting getFieldValue:');
const testProduct = {
  color: 'D',
  size: 1.5,
  clarity: 'VS1'
};
console.log('  color -> ', productUtils.getFieldValue(testProduct, 'color'));
console.log('  carat (with fallback to size) -> ', productUtils.getFieldValue(testProduct, 'carat', ['size', 'weight']));
console.log('  missing field -> ', productUtils.getFieldValue(testProduct, 'missing'));

console.log('\nModule test complete!') 