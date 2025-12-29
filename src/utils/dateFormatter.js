/**
 * Formats a date value to DD/MM/YYYY format
 * @param {string|Date|null|undefined} dateValue - ISO date string, Date object, or null/undefined
 * @returns {string} Formatted date string (DD/MM/YYYY) or empty string if invalid/null
 */
export const formatDate = (dateValue) => {
  if (!dateValue) return '';
  
  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Use en-GB locale to get DD/MM/YYYY format
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Formats a date and time value to DD/MM/YYYY HH:MM format
 * @param {string|Date|null|undefined} dateValue - ISO date string or Date object
 * @param {string|null|undefined} timeValue - Time string (HH:MM format) or null/undefined
 * @returns {string} Formatted date and time string or date only if time is not provided
 */
export const formatDateTime = (dateValue, timeValue = null) => {
  if (!dateValue) return '';
  
  try {
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (timeValue) {
      // Combine date and time
      date = new Date(`${dateValue}T${timeValue}`);
    } else {
      date = new Date(dateValue);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Format date as DD/MM/YYYY
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    // Format time if provided
    if (timeValue || dateValue instanceof Date) {
      const timeStr = date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return `${dateStr} ${timeStr}`;
    }
    
    return dateStr;
  } catch (error) {
    console.error('Error formatting date-time:', error);
    return '';
  }
};

/**
 * Formats a date for display with weekday, month, and day (e.g., "Monday, 16 December")
 * CRITICAL: For YYYY-MM-DD strings, MUST use LOCAL date methods to avoid timezone shifts
 * @param {string|Date|null|undefined} dateValue - YYYY-MM-DD string, ISO date string, or Date object
 * @returns {string} Formatted date string or empty string if invalid/null
 */
export const formatDateLong = (dateValue) => {
  if (!dateValue) return '';
  
  try {
    let date;
    
    // PRIORITY 1: If it's a YYYY-MM-DD string, parse it carefully to avoid UTC shift
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      // Parse as LOCAL date, not UTC
      // Split the string and create date using local timezone
      const [year, month, day] = dateValue.split('-').map(Number);
      date = new Date(year, month - 1, day); // month is 0-indexed
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      // For other string formats, parse as Date but be aware of timezone issues
      date = new Date(dateValue);
    }
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Use LOCAL date methods for formatting
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting long date:', error);
    return '';
  }
};

/**
 * Normalizes a date value to YYYY-MM-DD format (LOCAL timezone, never UTC)
 * CRITICAL: If the value is already YYYY-MM-DD string, NEVER wrap it in new Date()
 * This function ensures dates remain as strings throughout the application
 * @param {string|Date|null|undefined} dateValue - Date value in various formats
 * @returns {string} Normalized date string in YYYY-MM-DD format or empty string if invalid/null
 */
export const normalizeDateToYMD = (dateValue) => {
  if (!dateValue) return '';

  // PRIORITY 1: If it's already a YYYY-MM-DD string, return it directly (no parsing needed)
  // This is the SAFEST case - no Date object creation means no timezone shift
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  // PRIORITY 2: If it's an ISO string or starts with YYYY-MM-DD, extract just the date part
  // Handles "2025-12-20T00:00:00.000Z" or "2025-12-20 00:00:00" - extract first 10 chars
  // This avoids Date object creation by using string manipulation only
  if (typeof dateValue === 'string') {
    const ymdMatch = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
    if (ymdMatch) {
      return ymdMatch[1]; // Return the YYYY-MM-DD part only
    }
  }

  // PRIORITY 3: For Date objects (should be rare if backend normalizes correctly)
  // Use LOCAL methods (not UTC) to get the date as displayed locally
  // This ensures the date matches what the user sees in their timezone
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return '';
    const year = dateValue.getFullYear(); // LOCAL year (not getUTCFullYear)
    const month = String(dateValue.getMonth() + 1).padStart(2, '0'); // LOCAL month (not getUTCMonth)
    const day = String(dateValue.getDate()).padStart(2, '0'); // LOCAL day (not getUTCDate)
    return `${year}-${month}-${day}`;
  }

  // Last resort: try to parse as Date and extract LOCAL date
  if (typeof dateValue === 'string') {
    try {
      const parsedDate = new Date(dateValue);
      if (!isNaN(parsedDate.getTime())) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  return '';
};

/**
 * Formats a date value for HTML5 date input (YYYY-MM-DD format)
 * HTML5 date inputs require YYYY-MM-DD format, not ISO strings
 * @param {string|Date|null|undefined} dateValue - ISO date string (e.g., "2021-01-16T22:00:00.000Z"), Date object, or null/undefined
 * @returns {string} Formatted date string in YYYY-MM-DD format or empty string if invalid/null
 */
export const formatDateForInput = (dateValue) => {
  if (!dateValue) return '';
  
  // Use normalizeDateToYMD for consistent date handling
  return normalizeDateToYMD(dateValue);
};

/**
 * Safely formats a YYYY-MM-DD date string to DD/MM/YYYY format
 * Uses string manipulation only - NO Date object creation to avoid timezone issues
 * @param {string} dateValue - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string (DD/MM/YYYY) or empty string if invalid
 * 
 * Test cases:
 * A) "2026-01-06" => "06/01/2026"
 * B) "2026-01-06T09:00:00Z" => "06/01/2026" (extracts date part)
 * C) "2026-01-06T00:30:00Z" => "06/01/2026" (no day shift)
 */
export const formatDateDDMMYYYY = (dateValue) => {
  if (!dateValue) return '';
  
  // If it's already a YYYY-MM-DD string, extract and rearrange using string manipulation
  if (typeof dateValue === 'string') {
    // Extract YYYY-MM-DD part if it's in a longer string (e.g., ISO datetime)
    const ymdMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      // Rearrange to DD/MM/YYYY
      return `${day}/${month}/${year}`;
    }
  }
  
  // If not a valid YYYY-MM-DD string, return empty
  return '';
};

/**
 * Safely formats a time string to HH:MM format (24-hour)
 * Uses string manipulation only - NO Date object creation to avoid timezone issues
 * @param {string} timeValue - Time string in HH:mm or HH:mm:ss format
 * @returns {string} Formatted time string (HH:MM) or empty string if invalid
 * 
 * Test cases:
 * A) "09:00:00" => "09:00"
 * B) "09:00" => "09:00"
 * C) "00:30:00" => "00:30" (no conversion)
 */
export const formatTimeHHMM = (timeValue) => {
  if (!timeValue) return '';
  
  if (typeof timeValue === 'string') {
    // Extract HH:MM from HH:mm or HH:mm:ss format
    const timeMatch = timeValue.match(/^(\d{2}):(\d{2})/);
    if (timeMatch) {
      const [, hours, minutes] = timeMatch;
      return `${hours}:${minutes}`;
    }
  }
  
  return '';
};

/**
 * Safely formats appointment date and time to "📅 DD/MM/YYYY • ⏰ HH:MM" format
 * Uses string manipulation only - NO Date object creation to avoid timezone issues
 * Handles both separate date/time fields and ISO datetime strings
 * @param {Object} appointment - Appointment object with date, time, or dateTime fields
 * @returns {string} Formatted string in "📅 DD/MM/YYYY • ⏰ HH:MM" format or empty string
 * 
 * Test cases:
 * A) {date: "2026-01-06", time: "09:00:00"} => "📅 06/01/2026 • ⏰ 09:00"
 * B) {dateTime: "2026-01-06T09:00:00Z"} => "📅 06/01/2026 • ⏰ 09:00"
 * C) {dateTime: "2026-01-06T00:30:00Z"} => "📅 06/01/2026 • ⏰ 00:30" (no day shift)
 */
export const formatAppointmentDateTime = (appointment) => {
  if (!appointment) return '';
  
  let dateStr = '';
  let timeStr = '';
  
  // Case 1: Separate date and time fields
  if (appointment.date) {
    dateStr = formatDateDDMMYYYY(appointment.date);
  }
  
  if (appointment.time) {
    timeStr = formatTimeHHMM(appointment.time);
  }
  
  // Case 2: ISO datetime string (extract date and time parts)
  if (!dateStr && appointment.dateTime) {
    const dateTimeStr = String(appointment.dateTime);
    // Extract date part (first 10 chars: YYYY-MM-DD)
    const datePart = dateTimeStr.substring(0, 10);
    dateStr = formatDateDDMMYYYY(datePart);
    
    // Extract time part (chars 11-16: HH:MM)
    if (dateTimeStr.length >= 16) {
      const timePart = dateTimeStr.substring(11, 16);
      timeStr = formatTimeHHMM(timePart);
    } else if (dateTimeStr.length >= 13) {
      // Handle case where time might be shorter
      const timeMatch = dateTimeStr.match(/T(\d{2}):(\d{2})/);
      if (timeMatch) {
        const [, hours, minutes] = timeMatch;
        timeStr = `${hours}:${minutes}`;
      }
    }
  }
  
  // Build the combined string
  const parts = [];
  if (dateStr) {
    parts.push(`📅 ${dateStr}`);
  }
  if (timeStr) {
    parts.push(`⏰ ${timeStr}`);
  }
  
  return parts.length > 0 ? parts.join(' • ') : '';
};

