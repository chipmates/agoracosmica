/**
 * Touch Target Validator - Validates 44px minimum touch targets
 * 
 * This utility validates that all interactive elements meet Apple's 44px minimum touch target requirement
 * and WCAG 2.2 AA compliance standards.
 */

/**
 * Element information for validation results
 */
export interface ElementInfo {
  element: Element;
  tagName: string;
  className: string;
  id: string;
  width: number;
  height: number;
  selector: string;
}

/**
 * Non-compliant element with issues
 */
export interface NonCompliantElement extends ElementInfo {
  issues: string[];
}

/**
 * Warning element information
 */
export interface WarningElement extends ElementInfo {
  warning: string;
}

/**
 * Validation results structure
 */
export interface ValidationResults {
  compliant: ElementInfo[];
  nonCompliant: NonCompliantElement[];
  warnings: WarningElement[];
  totalChecked: number;
}

/**
 * Validates all interactive elements for 44px minimum touch targets
 * @returns Validation results with compliant and non-compliant elements
 */
export function validateTouchTargets(): ValidationResults {
  const results: ValidationResults = {
    compliant: [],
    nonCompliant: [],
    warnings: [],
    totalChecked: 0
  };

  // Selectors for interactive elements
  const interactiveSelectors: string[] = [
    'button',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'input[type="checkbox"]',
    'input[type="radio"]',
    '[role="button"]',
    '[role="switch"]',
    '[tabindex="0"]',
    'a[href]',
    '.toggle-switch',
    '.select-button-wrapper',
    '.close-button',
    '.nav-button',
    '.adaptive-select-button',
    '.miniature'
  ];

  // Get all interactive elements
  const elements: NodeListOf<Element> = document.querySelectorAll(interactiveSelectors.join(', '));
  
  elements.forEach((element: Element) => {
    results.totalChecked++;
    
    const rect: DOMRect = element.getBoundingClientRect();
    const computedStyle: CSSStyleDeclaration = window.getComputedStyle(element);
    
    // Check if element is visible
    if (rect.width === 0 || rect.height === 0 || computedStyle.display === 'none') {
      return; // Skip hidden elements
    }
    
    const width: number = rect.width;
    const height: number = rect.height;
    const minSize: number = 44; // Apple's minimum touch target
    
    const elementInfo: ElementInfo = {
      element,
      tagName: element.tagName.toLowerCase(),
      className: (element as HTMLElement).className || '',
      id: element.id,
      width: Math.round(width),
      height: Math.round(height),
      selector: getElementSelector(element)
    };
    
    // Check if both dimensions meet minimum
    if (width >= minSize && height >= minSize) {
      results.compliant.push(elementInfo);
    } else {
      const issues: string[] = [
        width < minSize ? `Width ${Math.round(width)}px < ${minSize}px` : null,
        height < minSize ? `Height ${Math.round(height)}px < ${minSize}px` : null
      ].filter((issue): issue is string => issue !== null);
      
      results.nonCompliant.push({
        ...elementInfo,
        issues
      });
    }
    
    // Check for potential warnings
    if (width < minSize + 4 || height < minSize + 4) {
      results.warnings.push({
        ...elementInfo,
        warning: `Close to minimum: ${Math.round(width)}px × ${Math.round(height)}px`
      });
    }
  });
  
  return results;
}

/**
 * Gets a unique selector for an element
 * @param element - The element to get a selector for
 * @returns CSS selector
 */
function getElementSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }
  
  const htmlElement = element as HTMLElement;
  if (htmlElement.className) {
    const classes: string[] = htmlElement.className.split(' ').filter(c => c).slice(0, 2);
    return `${element.tagName.toLowerCase()}.${classes.join('.')}`;
  }
  
  return element.tagName.toLowerCase();
}

/**
 * Runs validation and logs results to console
 */
export function runTouchTargetValidation(): ValidationResults {
  console.log('🎯 Touch Target Validation Starting...');
  
  const results: ValidationResults = validateTouchTargets();
  
  console.log('\n📊 TOUCH TARGET VALIDATION RESULTS:');
  console.log(`Total elements checked: ${results.totalChecked}`);
  console.log(`✅ Compliant: ${results.compliant.length}`);
  console.log(`❌ Non-compliant: ${results.nonCompliant.length}`);
  console.log(`⚠️ Warnings: ${results.warnings.length}`);
  
  if (results.nonCompliant.length > 0) {
    console.log('\n❌ NON-COMPLIANT ELEMENTS:');
    results.nonCompliant.forEach((item, index) => {
      console.log(`${index + 1}. ${item.selector} (${item.width}×${item.height}px)`);
      console.log(`   Issues: ${item.issues.join(', ')}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS (close to minimum):');
    results.warnings.forEach((item, index) => {
      console.log(`${index + 1}. ${item.selector} - ${item.warning}`);
    });
  }
  
  if (results.compliant.length > 0) {
    console.log('\n✅ SAMPLE COMPLIANT ELEMENTS:');
    results.compliant.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.selector} (${item.width}×${item.height}px)`);
    });
  }
  
  // Overall compliance percentage
  const complianceRate: number = results.totalChecked > 0 
    ? Math.round((results.compliant.length / results.totalChecked) * 100)
    : 0;
  
  console.log(`\n🎯 Overall Compliance: ${complianceRate}%`);
  
  if (complianceRate === 100) {
    console.log('🎉 ALL TOUCH TARGETS MEET 44PX MINIMUM REQUIREMENT!');
  } else {
    console.log(`🔧 ${results.nonCompliant.length} elements need to be fixed`);
  }
  
  return results;
}

/**
 * Creates a visual overlay showing touch target sizes
 * Useful for debugging and visual validation
 */
export function showTouchTargetOverlay(): void {
  // Remove existing overlay
  const existingOverlay: HTMLElement | null = document.getElementById('touch-target-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  const results: ValidationResults = validateTouchTargets();
  
  // Create overlay container
  const overlay: HTMLDivElement = document.createElement('div');
  overlay.id = 'touch-target-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.3);
  `;
  
  // Add indicators for each element
  [...results.compliant, ...results.nonCompliant].forEach((item: ElementInfo | NonCompliantElement) => {
    const rect: DOMRect = item.element.getBoundingClientRect();
    const indicator: HTMLDivElement = document.createElement('div');
    
    const isCompliant: boolean = item.width >= 44 && item.height >= 44;
    const color: string = isCompliant ? '#4CAF50' : '#F44336';
    
    indicator.style.cssText = `
      position: absolute;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 2px solid ${color};
      background: ${color}20;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      color: ${color};
      text-shadow: 0 0 3px rgba(0,0,0,0.8);
    `;
    
    indicator.textContent = `${item.width}×${item.height}`;
    overlay.appendChild(indicator);
  });
  
  document.body.appendChild(overlay);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    overlay.remove();
  }, 10000);
  
  console.log('👁️ Touch target overlay displayed (auto-removes in 10 seconds)');
}

// Make functions available globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).validateTouchTargets = runTouchTargetValidation;
  (window as any).showTouchTargetOverlay = showTouchTargetOverlay;
}