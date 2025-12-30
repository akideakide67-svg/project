import React, { createContext, useContext, useEffect, useState } from "react";
import { API } from "../utils/api";

const ClinicContext = createContext(undefined);

export const ClinicProvider = ({ children }) => {
  /* ================= STATE ================= */
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [scheduleConfigs, setScheduleConfigs] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);

  // ❌ REMOVED appointment-medications
  const [causes, setCauses] = useState([]);
  const [documents, setDocuments] = useState([]);

  // per patient
  const [allergies, setAllergies] = useState([]);
  const [vaccins, setVaccins] = useState([]);
  const [medications, setMedications] = useState([]);
  const [familyHistory, setFamilyHistory] = useState([]);

  // Reference data (for dropdowns - database-driven only)
  const [referenceAllergies, setReferenceAllergies] = useState([]);
  const [referenceMedications, setReferenceMedications] = useState([]);
  const [referenceVaccinations, setReferenceVaccinations] = useState([]);
  const [referenceFamilyHistory, setReferenceFamilyHistory] = useState([]);
  const [referenceCauses, setReferenceCauses] = useState([]);
  
  // Appointment-specific prescriptions (linked to appointments, not patients)
  const [appointmentMedications, setAppointmentMedications] = useState([]);

  const [loading, setLoading] = useState(false);

  /* ================= HELPERS ================= */
  const fetchJSON = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  };

  // Helper to normalize date to YYYY-MM-DD format (using LOCAL date, never UTC)
  // CRITICAL: If the value is already YYYY-MM-DD string, NEVER wrap it in new Date()
  // This function ensures dates remain as strings throughout the application
  // MUST be defined early so it can be used in loadScheduleConfigs and other functions
  const normalizeDate = (date) => {
    if (!date) return null;

    // PRIORITY 1: If it's already a YYYY-MM-DD string, return it directly (no parsing needed)
    // This is the SAFEST case - no Date object creation means no timezone shift
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    // PRIORITY 2: If it's an ISO string or starts with YYYY-MM-DD, extract just the date part
    // Handles "2025-12-20T00:00:00.000Z" or "2025-12-20 00:00:00" - extract first 10 chars
    // This avoids Date object creation by using string manipulation only
    if (typeof date === "string") {
      const ymdMatch = date.match(/^(\d{4}-\d{2}-\d{2})/);
      if (ymdMatch) {
        return ymdMatch[1]; // Return the YYYY-MM-DD part only
      }
    }

    // PRIORITY 3: For Date objects (should be rare if backend normalizes correctly)
    // Use LOCAL methods (not UTC) to get the date as displayed locally
    // This ensures the date matches what the user sees in their timezone
    if (date instanceof Date) {
      if (isNaN(date.getTime())) return null;
      const year = date.getFullYear(); // LOCAL year (not getUTCFullYear)
      const month = String(date.getMonth() + 1).padStart(2, "0"); // LOCAL month (not getUTCMonth)
      const day = String(date.getDate()).padStart(2, "0"); // LOCAL day (not getUTCDate)
      return `${year}-${month}-${day}`;
    }

    return null;
  };

  /* ================= INITIAL LOAD ================= */
  const loadScheduleConfigs = async () => {
    try {
      const sc = await fetchJSON(`${API}/scheduleconfig`);
      console.log('[ClinicContext] loadScheduleConfigs fetched configs:', Array.isArray(sc) ? sc.length : 'n/a');
      // Normalize scheduleConfig dates to YYYY-MM-DD strings immediately when received
      // This ensures dates are always strings, never Date objects or ISO strings
      const normalized = (sc || []).map(config => ({
        ...config,
        date: normalizeDate(config.date) || config.date, // Normalize date to YYYY-MM-DD string
      }));
      setScheduleConfigs(normalized);
      console.log('[ClinicContext] scheduleConfigs state updated');
      return normalized;
    } catch (e) {
      console.error("Error loading schedule configs:", e);
      throw e;
    }
  };

  const deleteScheduleConfig = async (configId) => {
    try {
      console.log('[ClinicContext] deleteScheduleConfig called with id:', configId);
      
      // Call DELETE endpoint by ID
      await fetchJSON(`${API}/scheduleconfig/id/${configId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      // Remove the config from state immediately
      // This will trigger the useEffect that regenerates timeSlots
      setScheduleConfigs(prev => {
        const updated = prev.filter(c => c.id !== configId);
        console.log('[ClinicContext] Removed schedule config from state', {
          deletedId: configId,
          remainingCount: updated.length,
        });
        return updated;
      });

      // Note: timeSlots will be automatically regenerated by the useEffect
      // that depends on scheduleConfigs, so we don't need to manually update them
      
      return true;
    } catch (e) {
      console.error("Error deleting schedule config:", e);
      throw e;
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [
          p,
          a,
          sc,
          ac,
          d,
          al,
          v,
          m,
          fh,
          refAll,
          refMed,
          refVac,
          refFh,
          refCauses,
          am,
        ] = await Promise.all([
          fetchJSON(`${API}/patients`),
          fetchJSON(`${API}/appointments`),
          fetchJSON(`${API}/scheduleconfig`),
          fetchJSON(`${API}/appointment-causes`),
          fetchJSON(`${API}/documents`),
          fetchJSON(`${API}/patient-allergies`),
          fetchJSON(`${API}/patient-vaccins`),
          fetchJSON(`${API}/patient-medications`),
          fetchJSON(`${API}/patient-familyhistory`),
          fetchJSON(`${API}/reference-allergies`),
          fetchJSON(`${API}/reference-medications`),
          fetchJSON(`${API}/reference-vaccinations`),
          fetchJSON(`${API}/reference-familyhistory`),
          fetchJSON(`${API}/reference-causes`).catch(() => []), // Gracefully handle if endpoint doesn't exist
          fetchJSON(`${API}/appointment-medications`).catch(() => []), // Gracefully handle if table doesn't exist
        ]);

        setPatients(p);
        // Normalize appointments: add camelCase patientId from snake_case patient_id
        setAppointments(a.map(x => ({ ...x, patientId: x.patient_id })));
        // Normalize scheduleConfig dates to YYYY-MM-DD strings immediately when received
        // This ensures dates are always strings, never Date objects or ISO strings
        setScheduleConfigs((sc || []).map(config => ({
          ...config,
          date: normalizeDate(config.date) || config.date, // Normalize date to YYYY-MM-DD string
        })));

        // Map causes and add composite id for compatibility
        // Use description from joined cause table (cause_description) or fallback to description
        setCauses(ac.map(x => {
          const compositeId = `${x.appointment_id}-${x.cause_id}`;
          return {
            ...x, 
            appointmentId: x.appointment_id,
            id: compositeId,
            description: x.cause_description || x.description || "",
            cause_name: x.cause_description || x.description || "" // For frontend compatibility
          };
        }));
        setDocuments(d.map(x => ({ ...x, appointmentId: x.appointment_id })));

        setAllergies(al.map(x => ({ ...x, patientId: x.patient_id })));
        setVaccins(v.map(x => ({ ...x, patientId: x.patient_id })));
        setMedications(m.map(x => ({ ...x, patientId: x.patient_id })));
        setFamilyHistory(fh.map(x => ({ ...x, patientId: x.patient_id })));

        // Reference data
        setReferenceAllergies(refAll || []);
        setReferenceMedications(refMed || []);
        setReferenceVaccinations(refVac || []);
        setReferenceFamilyHistory(refFh || []);
        setReferenceCauses(refCauses || []);
        
        // Appointment medications
        setAppointmentMedications((am || []).map(x => ({ ...x, appointmentId: x.appointment_id })));
      } catch (e) {
        console.error(e);
        alert("Server error");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  /* ================= TIME SLOTS ================= */
  // Helper to normalize time to HH:MM format
  const normalizeTime = (time) => {
    if (!time) return null;
    const timeStr = String(time);
    // Handle HH:MM:SS format
    if (timeStr.includes(':')) {
      return timeStr.slice(0, 5);
    }
    return timeStr;
  };

  // Build slots from a schedule config
  const buildSlotsFromConfig = (c) => {
    if (!c?.date || !c?.starttime || !c?.endtime) return [];

    // Normalize date to YYYY-MM-DD format
    const normalizedDate = normalizeDate(c.date);
    if (!normalizedDate) {
      console.warn('[ClinicContext] buildSlotsFromConfig: failed to normalize date', { rawDate: c.date, configId: c.id });
      return [];
    }
    
    console.log('[ClinicContext] buildSlotsFromConfig', {
      configId: c.id,
      rawDate: c.date,
      normalizedDate,
      dateType: typeof c.date,
      isDateObject: c.date instanceof Date,
    });

    const slots = [];

    const startStr = normalizeTime(c.starttime);
    const endStr = normalizeTime(c.endtime);

    if (!startStr || !endStr) return [];

    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);

    if ([sh, sm, eh, em].some(isNaN)) return [];

    let start = sh * 60 + sm;
    const end = eh * 60 + em;

    if (start >= end) return []; // Invalid time range

    const step = Number(c.time_interval) || 30;
    const buffer = Number(c.buffer) || 0;

    let i = 0;
    while (start + step <= end) {
      const h = String(Math.floor(start / 60)).padStart(2, "0");
      const m = String(start % 60).padStart(2, "0");
      const time = `${h}:${m}`;

      // Create dateTime string for sorting/display (local timezone, no UTC conversion)
      // Note: We don't validate using Date object to avoid timezone shifts
      // The slot.date field is always the normalizedDate string (YYYY-MM-DD)
      // dateTime string is only used for sorting/display purposes, never for date matching
      const dateTimeStr = `${normalizedDate}T${time}:00`;

      slots.push({
        id: `${c.id}-${i}`,
        configId: c.id,
        date: normalizedDate, // Always YYYY-MM-DD string - NEVER a Date object
        time,
        dateTime: dateTimeStr, // ISO-like string for sorting/display, but represents LOCAL time
      });

      start += step + buffer;
      i++;
    }

    return slots;
  };



  useEffect(() => {
    console.log('[ClinicContext] scheduleConfigs changed, regenerating timeSlots', {
      configCount: scheduleConfigs.length,
      sampleConfigs: scheduleConfigs.slice(0, 3).map(c => ({
        id: c.id,
        rawDate: c.date,
        dateType: typeof c.date,
        isDateObject: c.date instanceof Date,
        dateString: String(c.date),
      })),
    });

    const all = scheduleConfigs.flatMap(buildSlotsFromConfig);
    console.log('[ClinicContext] Regenerating timeSlots from scheduleConfigs. configs:', scheduleConfigs.length, 'rawSlots:', all.length);
    
    // Log sample slot dates to verify normalization
    const sampleSlots = all.slice(0, 5).map(s => ({
      id: s.id,
      date: s.date,
      dateType: typeof s.date,
      configId: s.configId,
    }));
    console.log('[ClinicContext] Sample generated slots:', sampleSlots);
    
    // Verify that each slot's date has a corresponding scheduleconfig
    // This ensures slots are only generated for dates that have schedule configs
    const validConfigDates = new Set(scheduleConfigs.map(c => normalizeDate(c.date)));
    
    const withBooked = all
      .filter(s => {
        // Only include slots whose date has a schedule config
        const slotDate = normalizeDate(s.date);
        const hasConfig = validConfigDates.has(slotDate);
        if (!hasConfig) {
          console.warn('[ClinicContext] Slot filtered out - no schedule config for date:', {
            slotId: s.id,
            slotDate,
            configId: s.configId,
            availableDates: Array.from(validConfigDates).slice(0, 5)
          });
        }
        return hasConfig;
      })
      .map(s => {
        // Normalize appointment dates and times for comparison
        const isBooked = appointments.some(a => {
          const appointmentDate = normalizeDate(a.date);
          const appointmentTime = normalizeTime(a.time);
          return appointmentDate === s.date && appointmentTime === s.time;
        });
        return {
          ...s,
          isBooked,
        };
      });
    console.log('[ClinicContext] timeSlots (withBooked) size:', withBooked.length);
    setTimeSlots(withBooked);
  }, [scheduleConfigs, appointments]);

  const getSlotsForDate = (date) => {
    const normalizedInputDate = normalizeDate(date);
    if (!normalizedInputDate) {
      console.warn('[ClinicContext] getSlotsForDate: failed to normalize input date', { rawInput: date });
      return [];
    }

    // Debug: log first few slot dates to see what we're comparing against
    const sampleSlots = timeSlots.slice(0, 5).map(s => ({
      rawDate: s.date,
      normalized: normalizeDate(s.date),
      dateType: typeof s.date,
      configId: s.configId,
    }));

    // Get all unique dates in timeSlots to see what dates we have
    const uniqueDates = [...new Set(timeSlots.map(s => normalizeDate(s.date)))].slice(0, 10);

    // Track matches for logging (limit to first 3)
    // Since slot.date is always stored as YYYY-MM-DD string, we can compare directly
    // But we still normalize to handle edge cases where slot.date might not be a string
    let matchCount = 0;
    const result = timeSlots.filter(s => {
      // s.date should already be a YYYY-MM-DD string, but normalize to be safe
      const slotDate = normalizeDate(s.date);
      const matches = slotDate === normalizedInputDate;
      if (matches && matchCount < 3) {
        matchCount++;
        console.log('[ClinicContext] getSlotsForDate MATCH', {
          inputDate: normalizedInputDate,
          slotDate,
          slotId: s.id,
          configId: s.configId,
          slotDateType: typeof s.date,
        });
      }
      return matches;
    });

    console.log('[ClinicContext] getSlotsForDate', {
      rawInput: date,
      normalizedInputDate,
      totalTimeSlots: timeSlots.length,
      resultCount: result.length,
      uniqueDatesInSlots: uniqueDates,
      sampleSlots,
      matchingSlotDates: result.slice(0, 5).map(s => ({ date: s.date, id: s.id })),
    });

    return result;
  };

  /* ================= PATIENT HELPERS ================= */
  const getPatientById = (id) =>
    patients.find(p => String(p.id) === String(id));

  const getAppointmentsForPatient = (pid) =>
    appointments.filter(a => String(a.patient_id) === String(pid));

  // Fetch complete patient details including all medical history
  // Used by Doctor dashboard to view full patient profile
  const getPatientDetails = async (patientId) => {
    try {
      const data = await fetchJSON(`${API}/patients/${patientId}/details`);
      return data;
    } catch (error) {
      console.error('Error fetching patient details:', error);
      throw error;
    }
  };

  const findPatient = (name, contact) => {
    return patients.find(
      p => 
        p.name.toLowerCase() === name.toLowerCase() && 
        (p.continfo?.toLowerCase() === contact.toLowerCase() || p.contact?.toLowerCase() === contact.toLowerCase())
    );
  };

  /* ================= CRUD ================= */
  const addPatient = async (p) => {
    const data = await fetchJSON(`${API}/patients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    setPatients(prev => [...prev, data]);
    return data;
  };
 const updatePatient = async (p) => {
    const data = await fetchJSON(`${API}/patients/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    setPatients(prev => prev.map(patient => patient.id === p.id ? data : patient));
    return data;
  };

 const deletePatient = async (id) => {
  await fetchJSON(`${API}/patients/${id}`, {
    method: "DELETE",
  });
  setPatients(prev => prev.filter(p => p.id !== id));
};

  const bookAppointment = async (patientId, date, time, status, userId = null) => {
    try {
      // Date should already be YYYY-MM-DD string from caller, but normalize defensively
      // Use normalizeDate to ensure it's a proper YYYY-MM-DD string (NO Date object creation)
      const normalizedDate = normalizeDate(date);
      if (!normalizedDate) {
        throw new Error('Invalid date format');
      }
      
      // DEBUG: Log to verify date is not being shifted
      console.log('[ClinicContext] bookAppointment DEBUG:', {
        inputDate: date,
        inputDateType: typeof date,
        normalizedDate: normalizedDate,
        scheduleConfigsSample: scheduleConfigs.slice(0, 5).map(c => ({
          id: c.id,
          date: c.date,
          dateType: typeof c.date,
        })),
      });
      
      const normalizedTime = typeof time === 'string' 
        ? time.slice(0, 5) 
        : String(time).slice(0, 5);

      // If userId is not provided, try to get a default doctor
      // This is a temporary solution - in production, you should always have a valid user_id
      let finalUserId = userId;
      if (!finalUserId) {
        // Try to get the first doctor from the database as a fallback
        try {
          const doctors = await fetchJSON(`${API}/users`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          const doctor = doctors.find(u => u.role && u.role.toLowerCase() === 'doctor');
          if (doctor) {
            finalUserId = doctor.id;
            console.warn('No user_id provided, using default doctor:', finalUserId);
          } else {
            throw new Error('No doctor found in the system. Please contact administrator.');
          }
        } catch (fetchError) {
          console.error('Error fetching default doctor:', fetchError);
          throw new Error('Unable to assign doctor to appointment. Please try again or contact support.');
        }
      }

      console.log('[ClinicContext] Sending appointment request to backend:', {
        patient_id: patientId,
        user_id: finalUserId,
        date: normalizedDate, // This should match scheduleconfig.date exactly
        time: normalizedTime,
        status: status || "Normal"
      });

      const data = await fetchJSON(`${API}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          patient_id: patientId,
          user_id: finalUserId,
          date: normalizedDate, 
          time: normalizedTime, 
          status: status || "Normal" 
        }),
      });
      
      // Refetch all appointments to ensure state is fully synchronized
      // This ensures isBooked flags on slots are updated immediately
      try {
        const allAppointments = await fetchJSON(`${API}/appointments`);
        setAppointments(allAppointments);
        console.log('[ClinicContext] Appointments refetched after booking, count:', allAppointments.length);
      } catch (refetchError) {
        console.error('[ClinicContext] Error refetching appointments after booking:', refetchError);
        // Fallback: add the new appointment to state
        setAppointments(prev => [...prev, data]);
      }
      
      return data;
    } catch (error) {
      console.error('Appointment booking error:', error);
      // Re-throw error so it can be handled by the caller
      throw error;
    }
  };

  /* ================= MEDICAL HISTORY CRUD ================= */
  const addAllergy = async (item) => {
    const data = await fetchJSON(`${API}/patient-allergies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: item.patientId,
        allergy_id: item.allergy_id,
      }),
    });
    setAllergies(prev => [...prev, { ...data, patientId: data.patient_id }]);
    return data;
  };

  const updateAllergy = async (item) => {
    const data = await fetchJSON(`${API}/patient-allergies/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allergy_id: item.allergy_id,
      }),
    });
    setAllergies(prev => prev.map(a => a.id === item.id ? { ...data, patientId: data.patient_id } : a));
    return data;
  };

  const deleteAllergy = async (id) => {
    await fetchJSON(`${API}/patient-allergies/${id}`, { method: "DELETE" });
    setAllergies(prev => prev.filter(a => a.id !== id));
  };

  const addVaccin = async (item) => {
    const data = await fetchJSON(`${API}/patient-vaccins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: item.patientId,
        vaccin_id: item.vaccin_id,
        date: item.date,
      }),
    });
    setVaccins(prev => [...prev, { ...data, patientId: data.patient_id }]);
    return data;
  };

  const deleteVaccin = async (id) => {
    await fetchJSON(`${API}/patient-vaccins/${id}`, { method: "DELETE" });
    setVaccins(prev => prev.filter(v => v.id !== id));
  };

  const addMedication = async (item) => {
    const data = await fetchJSON(`${API}/patient-medications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: item.patientId,
        medication_id: item.medication_id,
        dose: item.dose || "",
        delay: item.delay || "",
      }),
    });
    setMedications(prev => [...prev, { ...data, patientId: data.patient_id }]);
    return data;
  };

  const updateMedication = async (item) => {
    const data = await fetchJSON(`${API}/patient-medications/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: item.patientId,
        medication_id: item.medication_id,
        dose: item.dose || "",
        delay: item.delay || "",
      }),
    });
    setMedications(prev => prev.map(m => m.id === item.id ? { ...data, patientId: data.patient_id } : m));
    return data;
  };

  const deleteMedication = async (id) => {
    await fetchJSON(`${API}/patient-medications/${id}`, { method: "DELETE" });
    setMedications(prev => prev.filter(m => m.id !== id));
  };

  const addFamilyHistory = async (item) => {
    const data = await fetchJSON(`${API}/patient-familyhistory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: item.patientId,
        familyhistory_id: item.familyhistory_id,
        level: item.level || null,
        date: item.date || null,
      }),
    });
    setFamilyHistory(prev => [...prev, { ...data, patientId: data.patient_id }]);
    return data;
  };

  const updateFamilyHistory = async (item) => {
    const data = await fetchJSON(`${API}/patient-familyhistory/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyhistory_id: item.familyhistory_id,
        level: item.level || null,
        date: item.date || null,
      }),
    });
    setFamilyHistory(prev => prev.map(fh => fh.id === item.id ? { ...data, patientId: data.patient_id || item.patientId } : fh));
    return data;
  };

  const deleteFamilyHistory = async (id) => {
    await fetchJSON(`${API}/patient-familyhistory/${id}`, { method: "DELETE" });
    setFamilyHistory(prev => prev.filter(fh => fh.id !== id));
  };

  /* ================= APPOINTMENT CRUD ================= */
  const updateAppointment = async (appointment) => {
    const data = await fetchJSON(`${API}/appointments/${appointment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: appointment.patientId || appointment.patient_id,
        user_id: appointment.userId || appointment.user_id,
        date: appointment.date,
        time: appointment.time,
        status: appointment.status || "Normal",
        note: appointment.note || appointment.observation || "",
      }),
    });
    setAppointments(prev => prev.map(a => a.id === appointment.id ? { ...data, patientId: data.patient_id } : a));
    return data;
  };

  // Get appointment with full details (causes, prescriptions, reports)
  const getAppointmentDetails = async (appointmentId) => {
    try {
      const data = await fetchJSON(`${API}/appointments/${appointmentId}/details`);
      return data;
    } catch (error) {
      console.error('Error fetching appointment details:', error);
      throw error;
    }
  };

  // Get patient's full medical history (all appointments with their data)
  const getPatientMedicalHistory = async (patientId) => {
    try {
      const data = await fetchJSON(`${API}/patients/${patientId}/medical-history`);
      return data;
    } catch (error) {
      console.error('Error fetching patient medical history:', error);
      throw error;
    }
  };

  /* ================= APPOINTMENT CAUSES ================= */
  const addCause = async (cause) => {
    const data = await fetchJSON(`${API}/appointment-causes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_id: cause.appointmentId || cause.appointment_id,
        cause_id: cause.cause_id || cause.causeId || null,
        description: cause.description || null,
      }),
    });
    // Create a composite id for the cause (appointment_id + cause_id)
    const causeKey = `${data.appointment_id}-${data.cause_id}`;
    setCauses(prev => [...prev, { ...data, appointmentId: data.appointment_id, id: causeKey }]);
    return data;
  };

  const deleteCause = async (id) => {
    // id is in format "appointment_id-cause_id"
    await fetchJSON(`${API}/appointment-causes/${id}`, { method: "DELETE" });
    setCauses(prev => prev.filter(c => c.id !== id));
  };

  /* ================= APPOINTMENT PRESCRIPTIONS ================= */
  const addPrescription = async (prescription) => {
    const data = await fetchJSON(`${API}/appointment-medications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_id: prescription.appointmentId || prescription.appointment_id,
        medication_id: prescription.medication_id || prescription.medicationId,
        dose: prescription.dose || "",
        delay: prescription.delay || "",
      }),
    });
    setAppointmentMedications(prev => [...prev, { ...data, appointmentId: data.appointment_id }]);
    return data;
  };

  const updatePrescription = async (prescription) => {
    const data = await fetchJSON(`${API}/appointment-medications/${prescription.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medication_id: prescription.medication_id || prescription.medicationId,
        dose: prescription.dose || "",
        delay: prescription.delay || "",
      }),
    });
    setAppointmentMedications(prev => prev.map(p => p.id === prescription.id ? { ...data, appointmentId: data.appointment_id } : p));
    return data;
  };

  const deletePrescription = async (id) => {
    await fetchJSON(`${API}/appointment-medications/${id}`, { method: "DELETE" });
    setAppointmentMedications(prev => prev.filter(p => p.id !== id));
  };

  /* ================= APPOINTMENT DOCUMENTS/REPORTS ================= */
  const addDocument = async (document) => {
    const data = await fetchJSON(`${API}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_id: document.appointmentId || document.appointment_id,
        type: document.type,
        content: document.content || "",
      }),
    });
    setDocuments(prev => [...prev, { ...data, appointmentId: data.appointment_id }]);
    return data;
  };

  const deleteDocument = async (id) => {
    await fetchJSON(`${API}/documents/${id}`, { method: "DELETE" });
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  /* ================= CONTEXT ================= */
  return (
    <ClinicContext.Provider
      value={{
        API,
        loading,

        patients,
        appointments,
        scheduleConfigs,
        timeSlots,

        causes,
        documents,
        appointmentMedications,

        allergies,
        vaccins,
        medications,
        familyHistory,

        referenceAllergies,
        referenceMedications,
        referenceVaccinations,
        referenceFamilyHistory,
        referenceCauses,

        getPatientById,
        getAppointmentsForPatient,
        getPatientDetails,
        getPatientMedicalHistory,
        getAppointmentDetails,
        getSlotsForDate,
        findPatient,
        loadScheduleConfigs,
        deleteScheduleConfig,

        addPatient,
        updatePatient,
        deletePatient,
        bookAppointment,
        updateAppointment,

        addCause,
        deleteCause,
        addPrescription,
        updatePrescription,
        deletePrescription,
        addDocument,
        deleteDocument,

        addAllergy,
        updateAllergy,
        deleteAllergy,
        addVaccin,
        deleteVaccin,
        addMedication,
        updateMedication,
        deleteMedication,
        addFamilyHistory,
        updateFamilyHistory,
        deleteFamilyHistory,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
};

export const useClinic = () => {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error("useClinic must be used inside ClinicProvider");
  return ctx;
};
