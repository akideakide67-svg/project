// server.js
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const PDFDocument = require("pdfkit");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5050;


/* ============================================================
   DATABASE CONNECTION
============================================================ */
// const db = mysql.createConnection({
//   host: "127.0.0.1",
//   user: "root",
//   password: "",
//   database: "clinic_system",
// });
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
});

// db.connect((err) => {
//   if (err) {
//     console.error("❌ DB connection failed:", err);
//     return;
//   }
//   console.log("✅ Connected to MySQL (clinic_system)");
// });
db.connect((err) => {
  if (err) {
    console.error("❌ DB Error:", err);
    return;
  }
  console.log("✅ MySQL Connected");
});

/* ============================================================
   HELPER
============================================================ */
const runQuery = (sql, params, res, single = false) => {
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "DB error", error: err });
    }
    if (single) {
      if (!results || results.length === 0) {
        return res.status(404).json({ message: "Not found" });
      }
      return res.json(results[0]);
    }
    res.json(results);
  });
};

/* ============================================================
   TEST
============================================================ */
app.get("/test", (req, res) => res.send("TEST OK"));

/* ============================================================
   AUTH: LOGIN ONLY (NO SIGNUP)
============================================================ */

// ❌ REGISTER DISABLED
app.post("/users/register", (req, res) => {
  return res.status(403).json({
    message:
      "Signup disabled. Doctor/Secretary accounts are created directly in the database.",
  });
});

// ✅ LOGIN (bcrypt compare)
app.post("/users/login", (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Missing email or password" });
  }

  db.query("SELECT * FROM user WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = results[0];

   
    const match = password === user.passhash;

    if (!match) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ message: "Wrong role" });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  });
});

// GET all users (اختياري)
app.get("/users", (req, res) => {
  runQuery("SELECT id, name, email, role FROM user", [], res);
});


/* ============================================================
   PATIENTS CRUD
============================================================ */

app.get("/patients", (req, res) => runQuery("SELECT * FROM patient", [], res));

app.get("/patients/:id", (req, res) =>
  runQuery("SELECT * FROM patient WHERE id = ?", [req.params.id], res, true)
);

// GET patient's full medical history (all appointments with their data, ordered chronologically)
app.get("/patients/:id/medical-history", (req, res) => {
  const { id } = req.params;
  
  // Fetch all appointments for this patient, ordered chronologically (old → new)
  db.query(
    `SELECT * FROM appointment 
     WHERE patient_id = ? 
     ORDER BY date ASC, time ASC`,
    [id],
    (err, appointmentResults) => {
      if (err) {
        console.error("Error fetching patient appointments:", err);
        return res.status(500).json({ message: "Database error fetching appointments", error: err.message });
      }
      
      if (!appointmentResults || appointmentResults.length === 0) {
        return res.json([]);
      }
      
      // For each appointment, fetch its causes, prescriptions, and reports
      const appointmentsWithDetails = [];
      let processedCount = 0;
      
      appointmentResults.forEach((appointment, index) => {
        const appointmentId = appointment.id;
        
        // Fetch causes for this appointment
        db.query(
          `SELECT ac.appointment_id, ac.cause_id, c.description AS cause_description
           FROM appointment_cause ac
           JOIN cause c ON ac.cause_id = c.id
           WHERE ac.appointment_id = ?`,
          [appointmentId],
          (causeErr, causeResults) => {
            // Fetch prescriptions for this appointment
            db.query(
              `SELECT am.id, am.appointment_id, am.medication_id, am.dose, am.delay, m.name, m.description
               FROM appointment_medication am
               JOIN medication m ON am.medication_id = m.id
               WHERE am.appointment_id = ?`,
              [appointmentId],
              (prescriptionErr, prescriptionResults) => {
                // Fetch documents/reports for this appointment
                db.query(
                  "SELECT * FROM document WHERE appointment_id = ? ORDER BY date DESC",
                  [appointmentId],
                  (docErr, docResults) => {
                    // Combine all data for this appointment
                    appointmentsWithDetails.push({
                      ...appointment,
                      causes: (causeResults || []).map(c => ({
                        appointment_id: c.appointment_id,
                        cause_id: c.cause_id,
                        description: c.cause_description || "",
                        cause_name: c.cause_description || "" // For frontend compatibility
                      })),
                      prescriptions: (prescriptionResults || []).map(p => ({
                        id: p.id,
                        appointment_id: p.appointment_id,
                        medication_id: p.medication_id,
                        name: p.name,
                        description: p.description,
                        dose: p.dose,
                        delay: p.delay
                      })),
                      reports: (docResults || []).map(d => ({
                        id: d.id,
                        appointment_id: d.appointment_id,
                        type: d.type,
                        content: d.content,
                        date: d.date
                      }))
                    });
                    
                    processedCount++;
                    
                    // When all appointments are processed, return the result
                    if (processedCount === appointmentResults.length) {
                      // Sort by date and time (old → new)
                      appointmentsWithDetails.sort((a, b) => {
                        const dateTimeA = a.date && a.time ? new Date(`${a.date}T${a.time}`) : new Date(a.date || 0);
                        const dateTimeB = b.date && b.time ? new Date(`${b.date}T${b.time}`) : new Date(b.date || 0);
                        return dateTimeA.getTime() - dateTimeB.getTime();
                      });
                      res.json(appointmentsWithDetails);
                    }
                  }
                );
              }
            );
          }
        );
      });
    }
  );
});

// GET complete patient details including all medical history
// This endpoint returns patient basic info + allergies + medications + vaccines + family history
// Used by Doctor dashboard to view full patient profile
app.get("/patients/:id/details", (req, res) => {
  const { id } = req.params;
  
  // Fetch patient basic info
  db.query("SELECT * FROM patient WHERE id = ?", [id], (err, patientResults) => {
    if (err) {
      console.error("Error fetching patient:", err);
      return res.status(500).json({ message: "Database error fetching patient", error: err.message });
    }
    
    if (!patientResults || patientResults.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }
    
    const patient = patientResults[0];
    
    // Fetch all related medical history in parallel
    db.query(
      `SELECT pa.patient_id, pa.allergies_id as allergy_id, a.name, 
              CONCAT(pa.patient_id, '-', pa.allergies_id) as id
       FROM patient_allergies pa
       JOIN allergies a ON pa.allergies_id = a.id
       WHERE pa.patient_id = ?`,
      [id],
      (allergyErr, allergyResults) => {
        if (allergyErr) {
          console.error("Error fetching patient allergies:", allergyErr);
          return res.status(500).json({ message: "Database error fetching allergies", error: allergyErr.message });
        }
        
        db.query(
          `SELECT pv.patient_id, pv.vaccin_id, v.name, pv.date,
                  CONCAT(pv.patient_id, '-', pv.vaccin_id, '-', pv.date) as id
           FROM patient_vaccin pv
           JOIN vaccin v ON pv.vaccin_id = v.id
           WHERE pv.patient_id = ?`,
          [id],
          (vaccinErr, vaccinResults) => {
            if (vaccinErr) {
              console.error("Error fetching patient vaccines:", vaccinErr);
              return res.status(500).json({ message: "Database error fetching vaccines", error: vaccinErr.message });
            }
            
            db.query(
              `SELECT pm.patient_id, pm.medication_id, m.name, pm.dose, pm.delay,
                      CONCAT(pm.patient_id, '-', pm.medication_id) as id
               FROM patient_medication pm
               JOIN medication m ON pm.medication_id = m.id
               WHERE pm.patient_id = ?`,
              [id],
              (medErr, medResults) => {
                if (medErr) {
                  console.error("Error fetching patient medications:", medErr);
                  return res.status(500).json({ message: "Database error fetching medications", error: medErr.message });
                }
                
                db.query(
                  `SELECT pfh.patient_id, pfh.familyhistory_id, fh.name,
                          CONCAT(pfh.patient_id, '-', pfh.familyhistory_id) as id
                   FROM patient_familyhistory pfh
                   JOIN familyhistory fh ON pfh.familyhistory_id = fh.id
                   WHERE pfh.patient_id = ?`,
                  [id],
                  (fhErr, fhResults) => {
                    if (fhErr) {
                      console.error("Error fetching patient family history:", fhErr);
                      return res.status(500).json({ message: "Database error fetching family history", error: fhErr.message });
                    }
                    
                    // Return complete patient profile
                    res.json({
                      ...patient,
                      allergies: (allergyResults || []).map(a => ({
                        id: a.id,
                        patientId: a.patient_id,
                        allergy_id: a.allergy_id,
                        name: a.name
                      })),
                      vaccines: (vaccinResults || []).map(v => ({
                        id: v.id,
                        patientId: v.patient_id,
                        vaccin_id: v.vaccin_id,
                        name: v.name,
                        date: v.date
                      })),
                      medications: (medResults || []).map(m => ({
                        id: m.id,
                        patientId: m.patient_id,
                        medication_id: m.medication_id,
                        name: m.name,
                        dose: m.dose,
                        delay: m.delay
                      })),
                      familyHistory: (fhResults || []).map(fh => ({
                        id: fh.id,
                        patientId: fh.patient_id,
                        familyhistory_id: fh.familyhistory_id,
                        name: fh.name
                      }))
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

app.post("/patients", (req, res) => {
  const { name, gender, dob, continfo } = req.body;

  if (!name) return res.status(400).json({ message: "Name is required" });

  const sql =
    "INSERT INTO patient (name, gender, dob, continfo) VALUES (?, ?, ?, ?)";

  db.query(sql, [name, gender || "Other", dob || null, continfo || null], (err, r) => {
    if (err) return res.status(500).json({ error: err });

    res.json({
      id: r.insertId,
      name,
      gender: gender || "Other",
      dob: dob || null,
      continfo: continfo || null,
    });
  });
});

app.put("/patients/:id", (req, res) => {
  const { id } = req.params;
  const { name, gender, dob, continfo } = req.body;

  const sql =
    "UPDATE patient SET name = ?, gender = ?, dob = ?, continfo = ? WHERE id = ?";

  db.query(sql, [name, gender, dob, continfo, id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ id: Number(id), name, gender, dob, continfo });
  });
});

app.delete("/patients/:id", (req, res) => {
  const patientId = req.params.id;

  // Delete all related records first (due to foreign key constraints)
  // Delete in order: documents (references appointments), appointment_cause, appointment_medication, appointments, medical history, then patient
  
  // First, get all appointment IDs for this patient
  db.query("SELECT id FROM appointment WHERE patient_id = ?", [patientId], (err, appointmentResults) => {
    if (err) {
      console.error("Error fetching patient appointments:", err);
      return res.status(500).json({ message: "Database error fetching patient appointments", error: err.message });
    }

    const appointmentIds = (appointmentResults || []).map(a => a.id);

    // Helper function to delete appointments and continue with medical history
    const deleteAppointmentsAndContinue = () => {
      db.query("DELETE FROM appointment WHERE patient_id = ?", [patientId], (err) => {
        if (err) {
          console.error("Error deleting patient appointments:", err);
          return res.status(500).json({ message: "Database error deleting patient appointments", error: err.message });
        }

        // Delete medical history records
        db.query("DELETE FROM patient_allergies WHERE patient_id = ?", [patientId], (err) => {
          if (err) {
            console.error("Error deleting patient allergies:", err);
            return res.status(500).json({ message: "Database error deleting patient allergies", error: err.message });
          }

          db.query("DELETE FROM patient_vaccin WHERE patient_id = ?", [patientId], (err) => {
            if (err) {
              console.error("Error deleting patient vaccins:", err);
              return res.status(500).json({ message: "Database error deleting patient vaccins", error: err.message });
            }

            db.query("DELETE FROM patient_medication WHERE patient_id = ?", [patientId], (err) => {
              if (err) {
                console.error("Error deleting patient medications:", err);
                return res.status(500).json({ message: "Database error deleting patient medications", error: err.message });
              }

              db.query("DELETE FROM patient_familyhistory WHERE patient_id = ?", [patientId], (err) => {
                if (err) {
                  console.error("Error deleting patient family history:", err);
                  return res.status(500).json({ message: "Database error deleting patient family history", error: err.message });
                }

                // Finally, delete the patient
                db.query("DELETE FROM patient WHERE id = ?", [patientId], (err) => {
                  if (err) {
                    console.error("Error deleting patient:", err);
                    return res.status(500).json({ message: "Database error deleting patient", error: err.message });
                  }
                  res.json({ message: "Patient and all related records deleted successfully" });
                });
              });
            });
          });
        });
      });
    };

    // Delete documents that reference these appointments
    if (appointmentIds.length > 0) {
      const placeholders = appointmentIds.map(() => '?').join(',');
      db.query(`DELETE FROM document WHERE appointment_id IN (${placeholders})`, appointmentIds, (err) => {
        if (err) {
          console.error("Error deleting appointment documents:", err);
          return res.status(500).json({ message: "Database error deleting appointment documents", error: err.message });
        }

        // Delete appointment_cause records
        db.query(`DELETE FROM appointment_cause WHERE appointment_id IN (${placeholders})`, appointmentIds, (err) => {
          if (err) {
            console.error("Error deleting appointment causes:", err);
            return res.status(500).json({ message: "Database error deleting appointment causes", error: err.message });
          }

          // Delete appointment_medication records
          db.query(`DELETE FROM appointment_medication WHERE appointment_id IN (${placeholders})`, appointmentIds, (err) => {
            if (err) {
              console.error("Error deleting appointment medications:", err);
              return res.status(500).json({ message: "Database error deleting appointment medications", error: err.message });
            }

            // Now delete appointments
            deleteAppointmentsAndContinue();
          });
        });
      });
    } else {
      // No appointments, skip directly to medical history
      deleteAppointmentsAndContinue();
    }
  });
});

/* ============================================================
   APPOINTMENTS CRUD
============================================================ */

app.get("/appointments", (req, res) => runQuery("SELECT * FROM appointment", [], res));

// GET appointment with full details (causes, prescriptions, reports)
app.get("/appointments/:id/details", (req, res) => {
  const { id } = req.params;
  
  // Fetch appointment basic info
  db.query("SELECT * FROM appointment WHERE id = ?", [id], (err, appointmentResults) => {
    if (err) {
      console.error("Error fetching appointment:", err);
      return res.status(500).json({ message: "Database error fetching appointment", error: err.message });
    }
    
    if (!appointmentResults || appointmentResults.length === 0) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    
    const appointment = appointmentResults[0];
    
    // Fetch all related data for this appointment
    // Fetch causes
    db.query(
      `SELECT ac.appointment_id, ac.cause_id, c.description AS cause_description
       FROM appointment_cause ac
       JOIN cause c ON ac.cause_id = c.id
       WHERE ac.appointment_id = ?`,
      [id],
      (causeErr, causeResults) => {
        if (causeErr) {
          console.error("Error fetching appointment causes:", causeErr);
          return res.status(500).json({ message: "Database error fetching causes", error: causeErr.message });
        }
        
        // Fetch prescriptions (appointment_medication)
        db.query(
          `SELECT am.id, am.appointment_id, am.medication_id, am.dose, am.delay, m.name, m.description
           FROM appointment_medication am
           JOIN medication m ON am.medication_id = m.id
           WHERE am.appointment_id = ?`,
          [id],
          (prescriptionErr, prescriptionResults) => {
            if (prescriptionErr) {
              // If table doesn't exist, use empty array (graceful degradation)
              console.warn("Error fetching appointment medications (table may not exist):", prescriptionErr.message);
              prescriptionResults = [];
            }
            
            // Fetch documents/reports
            db.query(
              "SELECT * FROM document WHERE appointment_id = ? ORDER BY date DESC",
              [id],
              (docErr, docResults) => {
                if (docErr) {
                  console.error("Error fetching appointment documents:", docErr);
                  return res.status(500).json({ message: "Database error fetching documents", error: docErr.message });
                }
                
                // Return complete appointment data
                res.json({
                  ...appointment,
                  causes: (causeResults || []).map(c => ({
                    id: c.id,
                    appointment_id: c.appointment_id,
                    cause_id: c.cause_id,
                    description: c.description,
                    cause_name: c.cause_name
                  })),
                  prescriptions: (prescriptionResults || []).map(p => ({
                    id: p.id,
                    appointment_id: p.appointment_id,
                    medication_id: p.medication_id,
                    name: p.name,
                    description: p.description,
                    dose: p.dose,
                    delay: p.delay
                  })),
                  reports: (docResults || []).map(d => ({
                    id: d.id,
                    appointment_id: d.appointment_id,
                    type: d.type,
                    content: d.content,
                    date: d.date
                  }))
                });
              }
            );
          }
        );
      }
    );
  });
});

app.post("/appointments", (req, res) => {
  const { patient_id, user_id, date, time, status, note } = req.body;

  console.log("📅 [Booking] Appointment booking request:", { 
    patient_id, 
    user_id, 
    date, 
    dateType: typeof date,
    dateLength: date?.length,
    dateCharCodes: typeof date === 'string' ? date.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' ') : 'N/A',
    time, 
    status, 
    note 
  });

  if (!patient_id || !date || !time) {
    return res.status(400).json({ message: "patient_id, date, time required" });
  }

  // Validate user_id is provided and not null/undefined
  if (!user_id || user_id === null || user_id === undefined) {
    return res.status(400).json({ message: "user_id is required. A doctor must be assigned to the appointment." });
  }

  // Normalize date format to YYYY-MM-DD (LOCAL date, not UTC)
  // CRITICAL: Must match frontend normalization to avoid timezone shifts
  let normalizedDate;
  try {
    if (typeof date === 'string') {
      // Trim whitespace first
      const trimmed = date.trim();
      
      // If already in YYYY-MM-DD format, use it directly (most common case)
      if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) {
        normalizedDate = trimmed.slice(0, 10);
        // Validate it's a valid date string
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
          return res.status(400).json({ message: "Invalid date format" });
        }
      } 
      // If ISO string with time, extract date part (use UTC methods to avoid shift)
      else if (trimmed.includes('T')) {
        // For DATE fields, use UTC methods to get the exact date that was stored
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          const year = parsed.getUTCFullYear();
          const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
          const day = String(parsed.getUTCDate()).padStart(2, '0');
          normalizedDate = `${year}-${month}-${day}`;
        } else {
          return res.status(400).json({ message: "Invalid date format" });
        }
      } 
      // Try to parse as date string
      else {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          // Use UTC methods to avoid timezone shift (DATE fields are date-only)
          const year = parsed.getUTCFullYear();
          const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
          const day = String(parsed.getUTCDate()).padStart(2, '0');
          normalizedDate = `${year}-${month}-${day}`;
        } else {
          return res.status(400).json({ message: "Invalid date format" });
        }
      }
    } else if (date instanceof Date) {
      // For Date objects, use UTC methods to avoid timezone shift
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      normalizedDate = `${year}-${month}-${day}`;
    } else {
      return res.status(400).json({ message: "Invalid date format" });
    }
  } catch (dateError) {
    console.error("Error normalizing date:", dateError);
    return res.status(400).json({ message: "Invalid date format", error: dateError.message });
  }
  
  console.log("📅 [Booking] Date normalization:", { 
    original: date, 
    normalized: normalizedDate,
    originalType: typeof date,
    isDateObject: date instanceof Date,
    normalizedLength: normalizedDate?.length,
    normalizedCharCodes: normalizedDate ? normalizedDate.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' ') : 'N/A'
  });

  // Normalize time format (handle HH:MM:SS or HH:MM)
  const normalizedTime = String(time).slice(0, 5);
  
  // Validate time format
  if (!/^\d{2}:\d{2}$/.test(normalizedTime)) {
    return res.status(400).json({ message: "Invalid time format. Expected HH:MM" });
  }
  
  console.log("Normalized values:", { normalizedDate, normalizedTime });

  // Step 1: Validate patient exists
  db.query("SELECT id FROM patient WHERE id = ?", [patient_id], (err, patientResults) => {
    if (err) {
      console.error("Error checking patient:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      if (!res.headersSent) {
        return res.status(500).json({ message: "Database error checking patient", error: err.message });
      }
      return;
    }
    if (!patientResults || patientResults.length === 0) {
      if (!res.headersSent) {
        return res.status(400).json({ message: "Invalid patient_id. Patient does not exist." });
      }
      return;
    }

    // Step 2: Check if patient already has 2 appointments on this date
    db.query(
      "SELECT COUNT(*) as count FROM appointment WHERE patient_id = ? AND date = ?",
      [patient_id, normalizedDate],
      (err, countResults) => {
        if (err) {
          console.error("Error counting appointments:", err);
          if (!res.headersSent) {
            return res.status(500).json({ message: "Database error counting appointments", error: err.message });
          }
          return;
        }
        const appointmentCount = countResults[0]?.count || 0;
        
        if (appointmentCount >= 2) {
          if (!res.headersSent) {
            return res.status(400).json({ 
              message: "You have reached the maximum number of appointments for this day (2)." 
            });
          }
          return;
        }

        // Step 2.5: Check if patient already booked this exact slot (patient_id + date + time)
        db.query(
          "SELECT id FROM appointment WHERE patient_id = ? AND date = ? AND time = ?",
          [patient_id, normalizedDate, normalizedTime],
          (err, patientSlotResults) => {
            if (err) {
              console.error("Error checking patient slot booking:", err);
              if (!res.headersSent) {
                return res.status(500).json({ message: "Database error checking patient slot", error: err.message });
              }
              return;
            }
            if (patientSlotResults && patientSlotResults.length > 0) {
              if (!res.headersSent) {
                return res.status(400).json({ 
                  message: "You already have an appointment for this time." 
                });
              }
              return;
            }

            // Step 3: Check if slot is already booked by anyone (double booking prevention)
            db.query(
              "SELECT id FROM appointment WHERE date = ? AND time = ?",
              [normalizedDate, normalizedTime],
              (err, slotResults) => {
              if (err) {
                console.error("Error checking slot availability:", err);
                if (!res.headersSent) {
                  return res.status(500).json({ message: "Database error checking slot", error: err.message });
                }
                return;
              }
              if (slotResults && slotResults.length > 0) {
                if (!res.headersSent) {
                  return res.status(400).json({ 
                    message: "This appointment slot is already booked. Please select another time." 
                  });
                }
                return;
              }

              // Step 4: Validate that date/time exists in schedule configuration
              console.log("Checking schedule config for date:", {
                normalizedDate,
                dateType: typeof normalizedDate,
                query: "SELECT * FROM scheduleconfig WHERE date = ?"
              });
              
              // Try multiple query strategies to find the schedule config
              // Strategy 1: Direct comparison (most common case)
              console.log("🔍 [Booking Validation] Querying scheduleconfig:", {
                normalizedDate,
                normalizedDateType: typeof normalizedDate,
                normalizedDateLength: normalizedDate?.length,
                normalizedDateCharCodes: normalizedDate ? normalizedDate.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' ') : 'N/A',
                query: "SELECT * FROM scheduleconfig WHERE date = ?",
                parameter: [normalizedDate]
              });
              
              // Helper function to process schedule validation and create appointment
              const processScheduleValidation = (scheduleResults) => {
                if (!scheduleResults || scheduleResults.length === 0) {
                  // Show diagnostic and return error
                  db.query(
                    "SELECT date, id FROM scheduleconfig ORDER BY date DESC LIMIT 20",
                    [],
                    (diagErr, diagResults) => {
                      if (!diagErr && diagResults) {
                        const availableDatesNormalized = diagResults.map(r => {
                          let dateVal = r.date;
                          if (dateVal instanceof Date) {
                            const year = dateVal.getUTCFullYear();
                            const month = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
                            const day = String(dateVal.getUTCDate()).padStart(2, '0');
                            dateVal = `${year}-${month}-${day}`;
                          } else if (typeof dateVal === 'string') {
                            dateVal = dateVal.slice(0, 10);
                          }
                          return {
                            id: r.id,
                            date: dateVal,
                            dateType: typeof r.date,
                            dateString: String(r.date),
                          };
                        });
                        
                        console.error("🔍 [Booking Validation] Diagnostic - Available dates in DB:", {
                          requestedDate: normalizedDate,
                          requestedDateLength: normalizedDate?.length,
                          requestedDateCharCodes: normalizedDate?.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' '),
                          totalConfigsInDB: diagResults.length,
                          availableDates: availableDatesNormalized,
                          exactMatch: availableDatesNormalized.find(d => d.date === normalizedDate),
                          closestDates: availableDatesNormalized.slice(0, 5),
                        });
                      } else if (diagErr) {
                        console.error("❌ [Booking Validation] Diagnostic query error:", diagErr);
                      }
                      
                      if (!res.headersSent) {
                        return res.status(400).json({ 
                          message: "No schedule configuration found for this date. Appointments can only be created from schedule configuration." 
                        });
                      }
                    }
                  );
                  return;
                }

                // Validate time is within schedule
                try {
                  const schedule = scheduleResults[0];
                    const startTimeStr = String(schedule.starttime || '').slice(0, 5);
                    const endTimeStr = String(schedule.endtime || '').slice(0, 5);
                    
                    if (!startTimeStr || !endTimeStr) {
                      if (!res.headersSent) {
                        return res.status(400).json({ 
                          message: "Invalid schedule configuration. Start and end times are required." 
                        });
                      }
                      return;
                    }

                    const [startHour, startMin] = startTimeStr.split(':').map(Number);
                    const [endHour, endMin] = endTimeStr.split(':').map(Number);
                    const [timeHour, timeMin] = normalizedTime.split(':').map(Number);

                    if ([startHour, startMin, endHour, endMin, timeHour, timeMin].some(isNaN)) {
                      if (!res.headersSent) {
                        return res.status(400).json({ 
                          message: "Invalid time format in schedule or appointment time." 
                        });
                      }
                      return;
                    }

                    const startMinutes = startHour * 60 + startMin;
                    const endMinutes = endHour * 60 + endMin;
                    const timeMinutes = timeHour * 60 + timeMin;

                    if (timeMinutes < startMinutes || timeMinutes >= endMinutes) {
                      if (!res.headersSent) {
                        return res.status(400).json({ 
                          message: "Selected time is outside the scheduled hours for this date." 
                        });
                      }
                      return;
                    }

                    // All validations passed - create appointment
                    const sql = `
                      INSERT INTO appointment (patient_id, user_id, date, time, status, note)
                      VALUES (?, ?, ?, ?, ?, ?)
                    `;

                    console.log("Inserting appointment with values:", {
                      patient_id,
                      user_id: user_id || null,
                      date: normalizedDate,
                      time: normalizedTime,
                      status: status || "Normal",
                      note: note || null
                    });

                    db.query(
                      sql,
                      [patient_id, user_id, normalizedDate, normalizedTime, status || "Normal", note || null],
                      (err, r) => {
                        if (err) {
                          console.error("Error creating appointment:", err);
                          console.error("Error code:", err.code);
                          console.error("Error SQL state:", err.sqlState);
                          console.error("Error SQL message:", err.sqlMessage);
                          console.error("Full error:", JSON.stringify(err, null, 2));
                          if (!res.headersSent) {
                            return res.status(500).json({ 
                              message: "Database error creating appointment", 
                              error: err.message,
                              code: err.code,
                              sqlState: err.sqlState
                            });
                          }
                          return;
                        }

                        console.log("Appointment created successfully:", r.insertId);
                        if (!res.headersSent) {
                          res.json({
                            id: r.insertId,
                            patient_id,
                            user_id: user_id || null,
                            date: normalizedDate,
                            time: normalizedTime,
                            status: status || "Normal",
                            note: note || null,
                          });
                        }
                    }
                  );
                } catch (validationError) {
                  console.error("Error validating schedule:", validationError);
                  if (!res.headersSent) {
                    return res.status(500).json({ 
                      message: "Error validating schedule configuration", 
                      error: validationError.message 
                    });
                  }
                  return;
                }
              };

              // First try: Direct comparison
              db.query(
                "SELECT * FROM scheduleconfig WHERE date = ?",
                [normalizedDate],
                (err, scheduleResults) => {
                  if (err) {
                    console.error("❌ [Booking Validation] Error checking schedule config:", err);
                    if (!res.headersSent) {
                      return res.status(500).json({ message: "Database error checking schedule", error: err.message });
                    }
                    return;
                  }
                  
                  console.log("✅ [Booking Validation] Schedule config query results:", {
                    normalizedDate,
                    queryUsed: "SELECT * FROM scheduleconfig WHERE date = ?",
                    found: scheduleResults?.length || 0,
                    results: scheduleResults?.map(r => {
                      // Normalize the returned date for logging
                      let dateVal = r.date;
                      if (dateVal instanceof Date) {
                        const year = dateVal.getUTCFullYear();
                        const month = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(dateVal.getUTCDate()).padStart(2, '0');
                        dateVal = `${year}-${month}-${day}`;
                      } else if (typeof dateVal === 'string') {
                        dateVal = dateVal.slice(0, 10);
                      }
                      return {
                        id: r.id,
                        date: dateVal,
                        dateType: typeof r.date,
                        isDateObject: r.date instanceof Date,
                        dateString: String(r.date),
                        matchesRequested: dateVal === normalizedDate,
                      };
                    }) || []
                  });
                  
                  if (!scheduleResults || scheduleResults.length === 0) {
                    // Try alternative query as fallback
                    console.warn("⚠️ [Booking Validation] No schedule found, trying DATE() function fallback...");
                    db.query(
                      "SELECT * FROM scheduleconfig WHERE DATE(date) = DATE(?)",
                      [normalizedDate],
                      (altErr, altResults) => {
                        if (!altErr && altResults && altResults.length > 0) {
                          console.log("✅ [Booking Validation] Found using DATE() function fallback:", altResults.length);
                          processScheduleValidation(altResults);
                        } else {
                          processScheduleValidation([]);
                        }
                      }
                    );
                  } else {
                    processScheduleValidation(scheduleResults);
                  }
                }
              );
              }
            );
          }
        );
      }
    );
  });
});

app.put("/appointments/:id", (req, res) => {
  const { id } = req.params;
  const { patient_id, user_id, date, time, status, note } = req.body;

  const sql = `
    UPDATE appointment
    SET patient_id = ?, user_id = ?, date = ?, time = ?, status = ?, note = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [patient_id, user_id || null, date, time, status || "Normal", note || null, id],
    (err) => {
      if (err) return res.status(500).json({ error: err });

      res.json({
        id: Number(id),
        patient_id,
        user_id: user_id || null,
        date,
        time,
        status: status || "Normal",
        note: note || null,
      });
    }
  );
});

app.delete("/appointments/:id", (req, res) => {
  db.query("DELETE FROM appointment WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Appointment deleted" });
  });
});

/* ============================================================
   SCHEDULE CONFIG
============================================================ */

app.get("/scheduleconfig", (req, res) => {
  db.query("SELECT * FROM scheduleconfig ORDER BY date ASC, id ASC", [], (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "DB error", error: err });
    }
    
    console.log('[Server] GET /scheduleconfig: Raw results from MySQL', {
      count: results.length,
      sample: results.slice(0, 3).map(r => ({
        id: r.id,
        date: r.date,
        dateType: typeof r.date,
        isDateObject: r.date instanceof Date,
        dateString: String(r.date),
        dateISO: r.date instanceof Date ? r.date.toISOString() : null,
      })),
    });
    
    // Normalize DATE fields to YYYY-MM-DD strings to prevent timezone issues
    // mysql2 may return DATE fields as Date objects (midnight UTC), which can shift when serialized to JSON
    const normalized = results.map(row => {
      let dateStr = row.date;
      const originalDate = dateStr;
      
      // If it's already a string in YYYY-MM-DD format, use it directly
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        dateStr = dateStr.slice(0, 10);
      }
      // If it's a Date object (mysql2 sometimes returns DATE as Date at midnight UTC)
      // Extract using UTC methods to get the exact date that was stored
      else if (dateStr instanceof Date) {
        const year = dateStr.getUTCFullYear();
        const month = String(dateStr.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getUTCDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
        console.log('[Server] Normalized Date object to string', {
          original: originalDate.toISOString(),
          normalized: dateStr,
          UTCYear: year,
          UTCMonth: month,
          UTCDay: day,
        });
      }
      // If it's an ISO string, extract the date part
      else if (typeof dateStr === 'string' && dateStr.includes('T')) {
        dateStr = dateStr.slice(0, 10);
      }
      
      return {
        ...row,
        date: dateStr,
      };
    });
    
    console.log('[Server] GET /scheduleconfig: Normalized results', {
      count: normalized.length,
      sample: normalized.slice(0, 3).map(r => ({
        id: r.id,
        date: r.date,
        dateType: typeof r.date,
      })),
    });
    
    res.json(normalized);
  });
});

app.post("/scheduleconfig", (req, res) => {
  const { date, starttime, endtime, time_interval, buffer } = req.body;

  if (!date || !starttime || !endtime || !time_interval) {
    return res.status(400).json({ message: "Missing schedule fields" });
  }

  // Normalize date to YYYY-MM-DD format (ensure it's a DATE string, not DATETIME)
  // This must match the normalization used in POST /appointments for consistency
  let normalizedDate;
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) {
      normalizedDate = trimmed.slice(0, 10);
    } else {
      // Try to parse and normalize
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getUTCFullYear();
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        normalizedDate = `${year}-${month}-${day}`;
      } else {
        return res.status(400).json({ message: "Invalid date format" });
      }
    }
  } else if (date instanceof Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    normalizedDate = `${year}-${month}-${day}`;
  } else {
    return res.status(400).json({ message: "Invalid date format" });
  }

  // UPSERT: INSERT if new date, UPDATE if date already exists (enforced by UNIQUE constraint)
  const sql = `
    INSERT INTO scheduleconfig (date, starttime, endtime, time_interval, buffer)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      starttime = VALUES(starttime),
      endtime = VALUES(endtime),
      time_interval = VALUES(time_interval),
      buffer = VALUES(buffer)
  `;

  db.query(
    sql,
    [normalizedDate, starttime, endtime, time_interval, buffer || 0],
    (err, r) => {
      if (err) {
        console.error('Error saving schedule config:', err);
        return res.status(500).json({ error: err, message: "Database error saving schedule config" });
      }

      // After UPSERT, fetch the saved/updated record to return complete data
      db.query(
        "SELECT * FROM scheduleconfig WHERE date = ?",
        [normalizedDate],
        (fetchErr, results) => {
          if (fetchErr) {
            console.error('Error fetching saved schedule config:', fetchErr);
            // Fallback: return what we know
            return res.json({
              id: r.insertId || (results && results[0]?.id) || null,
              date: normalizedDate,
              starttime,
              endtime,
              time_interval,
              buffer: buffer || 0,
            });
          }

          if (!results || results.length === 0) {
            return res.status(500).json({ message: "Failed to retrieve saved schedule config" });
          }

          // Return the complete saved/updated record
          res.json(results[0]);
        }
      );
    }
  );
});

app.get("/scheduleconfig/by-date/:date", (req, res) => {
  const { date } = req.params;

  const sql = `
    SELECT * FROM scheduleconfig
    WHERE date = ?
    ORDER BY id DESC
    LIMIT 1
  `;

  db.query(sql, [date], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results || results.length === 0) return res.json(null);
    res.json(results[0]);
  });
});

app.delete("/scheduleconfig/id/:id", (req, res) => {
  const { id } = req.params;
  const configId = parseInt(id, 10);

  if (isNaN(configId)) {
    return res.status(400).json({ message: "Invalid schedule config ID" });
  }

  // First, get the schedule config to check its date
  db.query("SELECT id, date FROM scheduleconfig WHERE id = ?", [configId], (err, results) => {
    if (err) {
      console.error("Error fetching schedule config for deletion:", err);
      return res.status(500).json({ message: "Database error fetching schedule config", error: err.message });
    }

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Schedule config not found" });
    }

    const configDate = results[0].date;
    
    // Normalize date to YYYY-MM-DD format for comparison
    let normalizedDate;
    if (typeof configDate === 'string') {
      if (configDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        normalizedDate = configDate;
      } else if (configDate.match(/^\d{4}-\d{2}-\d{2}/)) {
        normalizedDate = configDate.slice(0, 10);
      }
    } else if (configDate instanceof Date) {
      // Extract date as YYYY-MM-DD string (local timezone)
      const year = configDate.getFullYear();
      const month = String(configDate.getMonth() + 1).padStart(2, '0');
      const day = String(configDate.getDate()).padStart(2, '0');
      normalizedDate = `${year}-${month}-${day}`;
    }

    if (!normalizedDate) {
      return res.status(500).json({ message: "Invalid date format in schedule config" });
    }

    // Check if any appointments exist for this date before deleting
    // Use string comparison: WHERE date = ? (no Date object conversion)
    db.query("SELECT COUNT(*) as count FROM appointment WHERE date = ?", [normalizedDate], (err, results) => {
      if (err) {
        console.error("Error checking appointments for schedule deletion:", err);
        return res.status(500).json({ message: "Database error checking appointments", error: err.message });
      }

      const appointmentCount = results && results[0] && results[0].count ? results[0].count : 0;

      if (appointmentCount > 0) {
        return res.status(400).json({ 
          message: "Cannot delete schedule: appointments already exist for this date" 
        });
      }

      // No appointments exist, safe to delete by ID
      db.query("DELETE FROM scheduleconfig WHERE id = ?", [configId], (err, result) => {
        if (err) {
          console.error("Error deleting schedule config:", err);
          return res.status(500).json({ message: "Database error deleting schedule", error: err.message });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Schedule config not found" });
        }

        res.json({ success: true, id: configId, date: normalizedDate });
      });
    });
  });
});

app.delete("/scheduleconfig/:date", (req, res) => {
  const { date } = req.params;

  // Normalize date to YYYY-MM-DD format (string only, no Date object)
  let normalizedDate;
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
      normalizedDate = trimmed;
    } else if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) {
      normalizedDate = trimmed.slice(0, 10);
    } else {
      return res.status(400).json({ message: "Invalid date format. Expected YYYY-MM-DD" });
    }
  } else {
    return res.status(400).json({ message: "Invalid date format. Expected YYYY-MM-DD string" });
  }

  // Check if any appointments exist for this date before deleting
  // Use string comparison: WHERE date = ? (no Date object conversion)
  db.query("SELECT COUNT(*) as count FROM appointment WHERE date = ?", [normalizedDate], (err, results) => {
    if (err) {
      console.error("Error checking appointments for schedule deletion:", err);
      return res.status(500).json({ message: "Database error checking appointments", error: err.message });
    }

    const appointmentCount = results && results[0] && results[0].count ? results[0].count : 0;

    if (appointmentCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete schedule: appointments already exist for this date" 
      });
    }

    // No appointments exist, safe to delete
    // Use string comparison: WHERE date = ? (no Date object conversion)
    db.query("DELETE FROM scheduleconfig WHERE date = ?", [normalizedDate], (err, result) => {
      if (err) {
        console.error("Error deleting schedule config:", err);
        return res.status(500).json({ message: "Database error deleting schedule", error: err.message });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Schedule config not found for this date" });
      }

      res.json({ success: true, date: normalizedDate });
    });
  });
});

/* ============================================================
   APPOINTMENT MEDICATIONS (per visit) ✅ ADDED
============================================================ */

// GET all appointment medications
/* ============================================================
   PATIENT MEDICATION (بدل appointment_medication)
============================================================ */

// GET patient medications
/* ============================================================
   APPOINTMENT CAUSES
============================================================ */

app.get("/appointment-causes", (req, res) => {
  const sql = `
    SELECT ac.appointment_id, ac.cause_id, c.description AS cause_description
    FROM appointment_cause ac
    JOIN cause c ON ac.cause_id = c.id
  `;
  runQuery(sql, [], res);
});

// GET causes for a specific appointment
app.get("/appointments/:id/causes", (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT ac.appointment_id, ac.cause_id, c.description AS cause_description
    FROM appointment_cause ac
    JOIN cause c ON ac.cause_id = c.id
    WHERE ac.appointment_id = ?
  `;
  runQuery(sql, [id], res);
});

app.post("/appointment-causes", (req, res) => {
  const { appointment_id, cause_id, description } = req.body;

  if (!appointment_id) {
    return res.status(400).json({ message: "appointment_id is required" });
  }

  // Support both cause_id (from reference table) and description (free text)
  // If cause_id is provided, link to existing cause
  // If description is provided, create new cause first, then link
  if (cause_id) {
    // Link to existing cause from reference table
    // Validate cause_id exists
    db.query("SELECT id, description FROM cause WHERE id = ?", [cause_id], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (!results || results.length === 0) {
        return res.status(400).json({ message: "Invalid cause_id. Must select from existing database records." });
      }

      const causeDescription = results[0].description || "";

      // Check if this combination already exists (to avoid duplicate)
      db.query("SELECT * FROM appointment_cause WHERE appointment_id = ? AND cause_id = ?", 
        [appointment_id, cause_id], (checkErr, existing) => {
          if (checkErr) return res.status(500).json({ error: checkErr });
          if (existing && existing.length > 0) {
            return res.status(400).json({ message: "This cause is already recorded for this appointment." });
          }

          // Insert into appointment_cause (only appointment_id and cause_id)
          db.query("INSERT INTO appointment_cause (appointment_id, cause_id) VALUES (?, ?)", 
            [appointment_id, cause_id], (insertErr) => {
              if (insertErr) return res.status(500).json({ error: insertErr });

              res.json({
                appointment_id,
                cause_id,
                description: causeDescription,
                cause_name: causeDescription, // For frontend compatibility
              });
            });
        });
    });
  } else if (description && description.trim()) {
    // Create new cause with free text description
    // Step 1: Insert into cause table
    db.query("INSERT INTO cause (description) VALUES (?)", [description.trim()], (err, result) => {
      if (err) return res.status(500).json({ error: err });
      
      const newCauseId = result.insertId;
      
      // Step 2: Link to appointment via appointment_cause
      db.query("INSERT INTO appointment_cause (appointment_id, cause_id) VALUES (?, ?)", 
        [appointment_id, newCauseId], (linkErr) => {
          if (linkErr) return res.status(500).json({ error: linkErr });
          
          res.json({
            appointment_id,
            cause_id: newCauseId,
            description: description.trim(),
            cause_name: description.trim(), // For frontend compatibility
          });
        });
    });
  } else {
    return res.status(400).json({ message: "Either cause_id or description is required" });
  }
});

app.delete("/appointment-causes/:id", (req, res) => {
  // The id parameter is in format "appointment_id-cause_id"
  const parts = req.params.id.split('-');
  if (parts.length !== 2) {
    return res.status(400).json({ message: "Invalid cause id format. Expected 'appointment_id-cause_id'" });
  }
  
  const appointmentId = parts[0];
  const causeId = parts[1];
  
  // Delete the link (appointment_cause row)
  // Note: We don't delete the cause itself, as it might be used by other appointments
  db.query("DELETE FROM appointment_cause WHERE appointment_id = ? AND cause_id = ?", 
    [appointmentId, causeId], (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "Cause deleted" });
    });
});

/* ============================================================
   APPOINTMENT PRESCRIPTIONS (medications per visit)
============================================================ */

app.get("/appointment-medications", (req, res) => {
  const sql = `
    SELECT am.id, am.appointment_id, am.medication_id, am.dose, am.delay, m.name, m.description
    FROM appointment_medication am
    JOIN medication m ON am.medication_id = m.id
  `;
  runQuery(sql, [], res);
});

// GET prescriptions for a specific appointment
app.get("/appointments/:id/prescriptions", (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT am.id, am.appointment_id, am.medication_id, am.dose, am.delay, m.name, m.description
    FROM appointment_medication am
    JOIN medication m ON am.medication_id = m.id
    WHERE am.appointment_id = ?
  `;
  runQuery(sql, [id], res);
});

app.post("/appointment-medications", (req, res) => {
  const { appointment_id, medication_id, dose, delay } = req.body;

  if (!appointment_id || !medication_id) {
    return res.status(400).json({ message: "appointment_id and medication_id required" });
  }

  // Validate that medication_id exists in reference table
  db.query("SELECT id, name, description FROM medication WHERE id = ?", [medication_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results || results.length === 0) {
      return res.status(400).json({ message: "Invalid medication_id. Must select from existing database records." });
    }

    const name = results[0].name;
    const description = results[0].description || "";

    const sql = `
      INSERT INTO appointment_medication (appointment_id, medication_id, dose, delay)
      VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [appointment_id, medication_id, dose || "", delay || ""], (err, r) => {
      if (err) return res.status(500).json({ error: err });

      res.json({
        id: r.insertId,
        appointment_id,
        medication_id,
        name,
        description,
        dose: dose || "",
        delay: delay || "",
      });
    });
  });
});

app.put("/appointment-medications/:id", (req, res) => {
  const { id } = req.params;
  const { medication_id, dose, delay } = req.body;

  if (!medication_id) {
    return res.status(400).json({ message: "medication_id is required" });
  }

  // Validate that medication_id exists in reference table
  db.query("SELECT id, name, description FROM medication WHERE id = ?", [medication_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results || results.length === 0) {
      return res.status(400).json({ message: "Invalid medication_id. Must select from existing database records." });
    }

    const name = results[0].name;
    const description = results[0].description || "";

    const sql = `
      UPDATE appointment_medication
      SET medication_id = ?, dose = ?, delay = ?
      WHERE id = ?
    `;

    db.query(sql, [medication_id, dose || "", delay || "", id], (err) => {
      if (err) return res.status(500).json({ error: err });

      // Fetch updated record with medication name
      db.query(
        `SELECT am.id, am.appointment_id, am.medication_id, am.dose, am.delay, m.name, m.description
         FROM appointment_medication am
         JOIN medication m ON am.medication_id = m.id
         WHERE am.id = ?`,
        [id],
        (fetchErr, fetchResults) => {
          if (fetchErr || !fetchResults || fetchResults.length === 0) {
            return res.json({
              id: Number(id),
              medication_id,
              name,
              description,
              dose: dose || "",
              delay: delay || "",
            });
          }
          const result = fetchResults[0];
          res.json({
            id: result.id,
            appointment_id: result.appointment_id,
            medication_id: result.medication_id,
            name: result.name,
            description: result.description,
            dose: result.dose,
            delay: result.delay
          });
        }
      );
    });
  });
});

app.delete("/appointment-medications/:id", (req, res) => {
  db.query("DELETE FROM appointment_medication WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Prescription deleted" });
  });
});

/* ============================================================
   DOCUMENTS (reports)
============================================================ */

app.get("/documents", (req, res) => runQuery("SELECT * FROM document", [], res));

app.post("/documents", (req, res) => {
  const { appointment_id, type, content } = req.body;

  if (!appointment_id || !type) {
    return res.status(400).json({ message: "appointment_id and type required" });
  }

  const date = new Date();
  const sql = `
    INSERT INTO document (appointment_id, type, content, date)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [appointment_id, type, content || "", date], (err, r) => {
    if (err) return res.status(500).json({ error: err });

    res.json({
      id: r.insertId,
      appointment_id,
      type,
      content: content || "",
      date,
    });
  });
});

// GET document PDF by ID
app.get("/documents/:id/pdf", (req, res) => {
  const documentId = req.params.id;

  db.query("SELECT * FROM document WHERE id = ?", [documentId], (err, results) => {
    if (err) {
      console.error("Error fetching document:", err);
      return res.status(500).json({ message: "Database error", error: err.message });
    }

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    const document = results[0];
    let contentData = {};

    // Parse JSON content if it exists
    if (document.content) {
      try {
        contentData = JSON.parse(document.content);
      } catch (parseErr) {
        console.error("Error parsing document content:", parseErr);
        // If content is not valid JSON, treat it as plain text
        contentData = { note: document.content };
      }
    }

    // Create PDF document
    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${document.type.replace(/\s+/g, "_")}_${documentId}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(20).font("Helvetica-Bold").text("ClinicSys Medical Center", { align: "center" });
    doc.fontSize(10).font("Helvetica").text("123 Health St, Wellness City", { align: "center" });
    doc.text("Phone: (123) 456-7890", { align: "center" });
    doc.moveDown(2);

    // Title (Report Type)
    doc.fontSize(18).font("Helvetica-Bold").text(document.type || "Medical Report", { align: "center" });
    doc.moveDown(1.5);

    // Date
    const reportDate = document.date
      ? new Date(document.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-GB");
    doc.fontSize(12).font("Helvetica").text(`Date: ${reportDate}`, { align: "left" });
    doc.moveDown(1);

    // Helper function to add a section
    const addSection = (title, content) => {
      if (!content) return;
      doc.fontSize(14).font("Helvetica-Bold").text(title, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica").text(String(content), { align: "left" });
      doc.moveDown(1);
    };

    // Patient Information
    if (contentData.patientInfo) {
      addSection("Patient Information", contentData.patientInfo);
    }

    // Medical History
    if (contentData.medicalHistory) {
      addSection("Medical History", contentData.medicalHistory);
    }

    // Type-specific sections based on ReportPrintView structure
    if (document.type === "Report (Compte Rendu)") {
      if (contentData.clinicalFindings) addSection("Clinical Findings", contentData.clinicalFindings);
      if (contentData.diagnosis) addSection("Diagnosis", contentData.diagnosis);
      if (contentData.treatmentAndRecommendations) {
        addSection("Treatment and Recommendations", contentData.treatmentAndRecommendations);
      }
    } else if (document.type === "Medical Certificate") {
      if (contentData.medicalExaminationFindings) {
        addSection("Medical Examination Findings", contentData.medicalExaminationFindings);
      }
      if (contentData.recommendations) addSection("Recommendations", contentData.recommendations);
      if (contentData.durationOfIncapacity) {
        addSection("Duration of Incapacity", contentData.durationOfIncapacity);
      }
    } else if (document.type === "Referral Letter") {
      if (contentData.referringDoctorInfo) addSection("Referring Doctor Information", contentData.referringDoctorInfo);
      if (contentData.reasonForReferral) addSection("Reason for Referral", contentData.reasonForReferral);
      if (contentData.clinicalFindingsAndResults) {
        addSection("Clinical Findings and Results", contentData.clinicalFindingsAndResults);
      }
      if (contentData.treatmentGiven) addSection("Treatment Given", contentData.treatmentGiven);
      if (contentData.patientCurrentStatus) addSection("Patient's Current Status", contentData.patientCurrentStatus);
      if (contentData.treatmentGoalsAndPlan) {
        addSection("Treatment Goals and Plan", contentData.treatmentGoalsAndPlan);
      }
    }

    // Add any other fields found in content that weren't already processed
    const processedFields = new Set([
      "patientInfo",
      "medicalHistory",
      "clinicalFindings",
      "diagnosis",
      "treatmentAndRecommendations",
      "medicalExaminationFindings",
      "recommendations",
      "durationOfIncapacity",
      "referringDoctorInfo",
      "reasonForReferral",
      "clinicalFindingsAndResults",
      "treatmentGiven",
      "patientCurrentStatus",
      "treatmentGoalsAndPlan",
    ]);

    Object.keys(contentData).forEach((key) => {
      if (!processedFields.has(key) && contentData[key]) {
        const fieldTitle = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
        addSection(fieldTitle, contentData[key]);
      }
    });

    // Signature section
    doc.moveDown(2);
    doc.fontSize(12).font("Helvetica-Bold").text("Doctor's Signature:", { continued: false });
    doc.moveDown(3);
    doc.fontSize(10).font("Helvetica").text("_________________________", { continued: false });
    doc.text(contentData.doctorName ? `Dr. ${contentData.doctorName}` : "Dr. [Doctor Name]");

    // Finalize PDF
    doc.end();
  });
});

/* ============================================================
   REFERENCE DATA (for dropdowns - database-driven only)
============================================================ */

// GET reference allergies
app.get("/reference-allergies", (req, res) => {
  runQuery("SELECT * FROM allergies ORDER BY name", [], res);
});

// GET reference medications
app.get("/reference-medications", (req, res) => {
  runQuery("SELECT * FROM medication ORDER BY name", [], res);
});

// GET reference vaccinations
app.get("/reference-vaccinations", (req, res) => {
  runQuery("SELECT * FROM vaccin ORDER BY name", [], res);
});

// GET reference family history
app.get("/reference-familyhistory", (req, res) => {
  runQuery("SELECT * FROM familyhistory ORDER BY name", [], res);
});

// GET reference causes
app.get("/reference-causes", (req, res) => {
  runQuery("SELECT * FROM cause ORDER BY id", [], res);
});

/* ============================================================
   MEDICAL HISTORY
============================================================ */

// GET patient allergies with names from reference table
app.get("/patient-allergies", (req, res) => {
  const sql = `
    SELECT pa.patient_id, pa.allergies_id as allergy_id, a.name, 
           CONCAT(pa.patient_id, '-', pa.allergies_id) as id
    FROM patient_allergies pa
    JOIN allergies a ON pa.allergies_id = a.id
  `;
  runQuery(sql, [], res);
});

app.post("/patient-allergies", (req, res) => {
  const { patient_id, allergy_id } = req.body;

  if (!patient_id || !allergy_id) {
    return res.status(400).json({ message: "patient_id and allergy_id required" });
  }

  // Validate that allergy_id exists in reference table
  db.query("SELECT id, name FROM allergies WHERE id = ?", [allergy_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results || results.length === 0) {
      return res.status(400).json({ message: "Invalid allergy_id. Must select from existing database records." });
    }

    const name = results[0].name;

    // Check if this relationship already exists
    db.query("SELECT * FROM patient_allergies WHERE patient_id = ? AND allergies_id = ?", 
      [patient_id, allergy_id], (err, existing) => {
        if (err) return res.status(500).json({ error: err });
        if (existing && existing.length > 0) {
          return res.status(400).json({ message: "This allergy is already recorded for this patient." });
        }

        const sql = `
          INSERT INTO patient_allergies (patient_id, allergies_id)
          VALUES (?, ?)
        `;

        db.query(sql, [patient_id, allergy_id], (err) => {
          if (err) return res.status(500).json({ error: err });

          res.json({
            id: `${patient_id}-${allergy_id}`,
            patient_id,
            allergy_id,
            name,
          });
        });
      });
  });
});

app.put("/patient-allergies/:id", (req, res) => {
  const { id } = req.params;
  const { patient_id, allergy_id } = req.body;

  if (!patient_id || !allergy_id) {
    return res.status(400).json({ message: "patient_id and allergy_id required" });
  }

  // Parse the composite key from id (format: "patient_id-allergy_id")
  const [oldPatientId, oldAllergyId] = id.split('-');

  // Validate that allergy_id exists in reference table
  db.query("SELECT id, name FROM allergies WHERE id = ?", [allergy_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results || results.length === 0) {
      return res.status(400).json({ message: "Invalid allergy_id. Must select from existing database records." });
    }

    const name = results[0].name;

    // Delete old record and insert new one (since it's a composite key)
    db.query("DELETE FROM patient_allergies WHERE patient_id = ? AND allergies_id = ?", 
      [oldPatientId, oldAllergyId], (err) => {
        if (err) return res.status(500).json({ error: err });

        // Check if new relationship already exists
        db.query("SELECT * FROM patient_allergies WHERE patient_id = ? AND allergies_id = ?", 
          [patient_id, allergy_id], (err, existing) => {
            if (err) return res.status(500).json({ error: err });
            if (existing && existing.length > 0) {
              return res.status(400).json({ message: "This allergy is already recorded for this patient." });
            }

            db.query("INSERT INTO patient_allergies (patient_id, allergies_id) VALUES (?, ?)", 
              [patient_id, allergy_id], (err) => {
                if (err) return res.status(500).json({ error: err });
                res.json({ id: `${patient_id}-${allergy_id}`, patient_id, allergy_id, name });
              });
          });
      });
  });
});

app.delete("/patient-allergies/:id", (req, res) => {
  // Parse composite key (format: "patient_id-allergy_id")
  const [patient_id, allergy_id] = req.params.id.split('-');
  db.query("DELETE FROM patient_allergies WHERE patient_id = ? AND allergies_id = ?", 
    [patient_id, allergy_id], (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "Allergy deleted" });
    });
});

/* ---------- VACCINS ---------- */
app.get("/patient-vaccins", (req, res) => {
  const sql = `
    SELECT pv.patient_id, pv.vaccin_id, pv.date, v.name,
           CONCAT(pv.patient_id, '-', pv.vaccin_id, '-', pv.date) as id
    FROM patient_vaccin pv
    JOIN vaccin v ON pv.vaccin_id = v.id
  `;
  runQuery(sql, [], res);
});

app.post("/patient-vaccins", (req, res) => {
  const { patient_id, vaccin_id, date } = req.body;

  if (!patient_id || !vaccin_id) {
    return res.status(400).json({ message: "patient_id and vaccin_id required" });
  }

  // Validate that vaccin_id exists in reference table
  db.query("SELECT id, name FROM vaccin WHERE id = ?", [vaccin_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results || results.length === 0) {
      return res.status(400).json({ message: "Invalid vaccin_id. Must select from existing database records." });
    }

    const name = results[0].name;
    const vDate = date || new Date().toISOString().slice(0, 10);
    
    // Check if this relationship already exists
    db.query("SELECT * FROM patient_vaccin WHERE patient_id = ? AND vaccin_id = ? AND date = ?", 
      [patient_id, vaccin_id, vDate], (err, existing) => {
        if (err) return res.status(500).json({ error: err });
        if (existing && existing.length > 0) {
          return res.status(400).json({ message: "This vaccination is already recorded for this patient on this date." });
        }

        const sql = `INSERT INTO patient_vaccin (patient_id, vaccin_id, date) VALUES (?, ?, ?)`;

        db.query(sql, [patient_id, vaccin_id, vDate], (err) => {
          if (err) return res.status(500).json({ error: err });

          res.json({ id: `${patient_id}-${vaccin_id}-${vDate}`, patient_id, vaccin_id, name, date: vDate });
        });
      });
  });
});

app.delete("/patient-vaccins/:id", (req, res) => {
  // Parse composite key (format: "patient_id-vaccin_id-date")
  const parts = req.params.id.split('-');
  const patient_id = parts[0];
  const vaccin_id = parts[1];
  const date = parts.slice(2).join('-'); // In case date has dashes
  
  db.query("DELETE FROM patient_vaccin WHERE patient_id = ? AND vaccin_id = ? AND date = ?", 
    [patient_id, vaccin_id, date], (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "Vaccination deleted" });
    });
});

/* ---------- MEDICATIONS ---------- */
app.get("/patient-medications", (req, res) => {
  const sql = `
    SELECT pm.patient_id, pm.medication_id, pm.dose, pm.delay, m.name, m.description,
           CONCAT(pm.patient_id, '-', pm.medication_id) as id
    FROM patient_medication pm
    JOIN medication m ON pm.medication_id = m.id
  `;
  runQuery(sql, [], res);
});

app.post("/patient-medications", (req, res) => {
  const { patient_id, medication_id, dose, delay } = req.body;

  if (!patient_id || !medication_id) {
    return res.status(400).json({ message: "patient_id and medication_id required" });
  }

  // Validate that medication_id exists in reference table
  db.query("SELECT id, name, description FROM medication WHERE id = ?", [medication_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results || results.length === 0) {
      return res.status(400).json({ message: "Invalid medication_id. Must select from existing database records." });
    }

    const name = results[0].name;
    const description = results[0].description || "";

    // Check if this relationship already exists
    db.query("SELECT * FROM patient_medication WHERE patient_id = ? AND medication_id = ?", 
      [patient_id, medication_id], (err, existing) => {
        if (err) return res.status(500).json({ error: err });
        if (existing && existing.length > 0) {
          return res.status(400).json({ message: "This medication is already recorded for this patient." });
        }

        const sql = `
          INSERT INTO patient_medication (patient_id, medication_id, dose, delay)
          VALUES (?, ?, ?, ?)
        `;

        db.query(sql, [patient_id, medication_id, dose || "", delay || ""], (err) => {
          if (err) return res.status(500).json({ error: err });

          res.json({
            id: `${patient_id}-${medication_id}`,
            patient_id,
            medication_id,
            name,
            description,
            dose: dose || "",
            delay: delay || "",
          });
        });
      });
  });
});

app.put("/patient-medications/:id", (req, res) => {
  const { id } = req.params;
  const { patient_id, medication_id, dose, delay } = req.body;

  if (!patient_id || !medication_id) {
    return res.status(400).json({ message: "patient_id and medication_id required" });
  }

  // Parse the composite key from id (format: "patient_id-medication_id")
  const [oldPatientId, oldMedicationId] = id.split('-');

  // Validate that medication_id exists in reference table
  db.query("SELECT id, name, description FROM medication WHERE id = ?", [medication_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results || results.length === 0) {
      return res.status(400).json({ message: "Invalid medication_id. Must select from existing database records." });
    }

    const name = results[0].name;
    const description = results[0].description || "";

    // Delete old record and insert new one (since it's a composite key)
    db.query("DELETE FROM patient_medication WHERE patient_id = ? AND medication_id = ?", 
      [oldPatientId, oldMedicationId], (err) => {
        if (err) return res.status(500).json({ error: err });

        // Check if new relationship already exists
        db.query("SELECT * FROM patient_medication WHERE patient_id = ? AND medication_id = ?", 
          [patient_id, medication_id], (err, existing) => {
            if (err) return res.status(500).json({ error: err });
            if (existing && existing.length > 0) {
              return res.status(400).json({ message: "This medication is already recorded for this patient." });
            }

            db.query("INSERT INTO patient_medication (patient_id, medication_id, dose, delay) VALUES (?, ?, ?, ?)", 
              [patient_id, medication_id, dose || "", delay || ""], (err) => {
                if (err) return res.status(500).json({ error: err });
                res.json({
                  id: `${patient_id}-${medication_id}`,
                  patient_id,
                  medication_id,
                  name,
                  description,
                  dose: dose || "",
                  delay: delay || "",
                });
              });
          });
      });
  });
});

app.delete("/patient-medications/:id", (req, res) => {
  // Parse composite key (format: "patient_id-medication_id")
  const [patient_id, medication_id] = req.params.id.split('-');
  db.query("DELETE FROM patient_medication WHERE patient_id = ? AND medication_id = ?", 
    [patient_id, medication_id], (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "Medication deleted" });
    });
});

app.get("/patient-familyhistory", (req, res) => {
  const sql = `
    SELECT pf.patient_id, pf.familyhistory_id, pf.level, pf.date, fh.name, fh.icd10,
           CONCAT(pf.patient_id, '-', pf.familyhistory_id, '-', pf.date) as id
    FROM patient_familyhistory pf
    JOIN familyhistory fh ON pf.familyhistory_id = fh.id
  `;
  runQuery(sql, [], res);
});

app.post("/patient-familyhistory", (req, res) => {
  const { patient_id, familyhistory_id, level, date } = req.body;

  if (!patient_id || !familyhistory_id) {
    return res.status(400).json({ message: "patient_id and familyhistory_id required" });
  }

  if (!date) {
    return res.status(400).json({ message: "date is required for family history" });
  }

  // Validate that familyhistory_id exists in reference table
  db.query("SELECT id, name FROM familyhistory WHERE id = ?", [familyhistory_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results || results.length === 0) {
      return res.status(400).json({ message: "Invalid familyhistory_id. Must select from existing database records." });
    }

    const name = results[0].name;

    // Check if this relationship already exists
    db.query("SELECT * FROM patient_familyhistory WHERE patient_id = ? AND familyhistory_id = ? AND date = ?", 
      [patient_id, familyhistory_id, date], (err, existing) => {
        if (err) return res.status(500).json({ error: err });
        if (existing && existing.length > 0) {
          return res.status(400).json({ message: "This family history is already recorded for this patient on this date." });
        }

        const sql = `
          INSERT INTO patient_familyhistory
          (patient_id, familyhistory_id, level, date)
          VALUES (?, ?, ?, ?)
        `;

        db.query(sql, [patient_id, familyhistory_id, level || null, date], (err) => {
          if (err) return res.status(500).json({ error: err });

          res.json({
            id: `${patient_id}-${familyhistory_id}-${date}`,
            patient_id,
            familyhistory_id,
            name,
            level: level || null,
            date: date,
          });
        });
      });
  });
});

app.put("/patient-familyhistory/:id", (req, res) => {
  const { id } = req.params;
  const { patient_id, familyhistory_id, level, date } = req.body;

  if (!patient_id || !familyhistory_id || !date) {
    return res.status(400).json({ message: "patient_id, familyhistory_id, and date are required" });
  }

  // Parse the composite key from id (format: "patient_id-familyhistory_id-date")
  const parts = id.split('-');
  const oldPatientId = parts[0];
  const oldFamilyhistoryId = parts[1];
  const oldDate = parts.slice(2).join('-'); // In case date has dashes

  // Validate that familyhistory_id exists in reference table
  db.query("SELECT id, name FROM familyhistory WHERE id = ?", [familyhistory_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results || results.length === 0) {
      return res.status(400).json({ message: "Invalid familyhistory_id. Must select from existing database records." });
    }

    const name = results[0].name;

    // Delete old record and insert new one (since it's a composite key)
    db.query("DELETE FROM patient_familyhistory WHERE patient_id = ? AND familyhistory_id = ? AND date = ?", 
      [oldPatientId, oldFamilyhistoryId, oldDate], (err) => {
        if (err) return res.status(500).json({ error: err });

        // Check if new relationship already exists
        db.query("SELECT * FROM patient_familyhistory WHERE patient_id = ? AND familyhistory_id = ? AND date = ?", 
          [patient_id, familyhistory_id, date], (err, existing) => {
            if (err) return res.status(500).json({ error: err });
            if (existing && existing.length > 0) {
              return res.status(400).json({ message: "This family history is already recorded for this patient on this date." });
            }

            db.query("INSERT INTO patient_familyhistory (patient_id, familyhistory_id, level, date) VALUES (?, ?, ?, ?)", 
              [patient_id, familyhistory_id, level || null, date], (err) => {
                if (err) return res.status(500).json({ error: err });
                res.json({
                  id: `${patient_id}-${familyhistory_id}-${date}`,
                  patient_id,
                  familyhistory_id,
                  name,
                  level: level || null,
                  date: date,
                });
              });
          });
      });
  });
});

app.delete("/patient-familyhistory/:id", (req, res) => {
  // Parse composite key (format: "patient_id-familyhistory_id-date")
  const parts = req.params.id.split('-');
  const patient_id = parts[0];
  const familyhistory_id = parts[1];
  const date = parts.slice(2).join('-'); // In case date has dashes
  
  db.query("DELETE FROM patient_familyhistory WHERE patient_id = ? AND familyhistory_id = ? AND date = ?", 
    [patient_id, familyhistory_id, date], (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "Family history deleted" });
    });
});

/* ============================================================
   ERROR HANDLING MIDDLEWARE
============================================================ */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (!res.headersSent) {
    res.status(500).json({ 
      message: "Internal server error", 
      error: err.message 
    });
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

/* ============================================================
   START SERVER
============================================================ */
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});
