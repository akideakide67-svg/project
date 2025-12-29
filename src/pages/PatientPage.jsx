import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinic } from '../context/ClinicContext';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { formatDate, formatDateTime, formatDateLong, normalizeDateToYMD, formatDateDDMMYYYY } from '../utils/dateFormatter';
import { FileText } from 'lucide-react';

const PatientAppointmentItem = ({ appointment }) => {
    const { appointmentMedications, causes, documents } = useClinic();
    const [isOpen, setIsOpen] = useState(false);
    
    // Determine if appointment is upcoming using string-based comparison (no Date objects)
    const isUpcoming = (() => {
        if (!appointment.date) return false;
        const appointmentDateStr = normalizeDateToYMD(appointment.date);
        if (!appointmentDateStr) return false;
        
        // Get today's date as YYYY-MM-DD string (local timezone)
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        // Compare dates as strings (YYYY-MM-DD format allows direct string comparison)
        if (appointmentDateStr > todayStr) return true;
        if (appointmentDateStr < todayStr) return false;
        
        // If same date, compare times if available
        if (appointment.time && appointment.time.length >= 5) {
            const appointmentTime = appointment.time.slice(0, 5); // HH:MM
            const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
            return appointmentTime > nowTime;
        }
        
        return false;
    })();
    
    // Filter causes and documents for this appointment
    const appointmentCauses = (causes || []).filter(c => {
        const causeAppointmentId = c.appointmentId || c.appointment_id;
        return String(causeAppointmentId) === String(appointment.id);
    });
    
    const appointmentDocuments = (documents || []).filter(d => {
        const docAppointmentId = d.appointmentId || d.appointment_id;
        return String(docAppointmentId) === String(appointment.id);
    });
    
    const appointmentMedicates = (appointmentMedications || []).filter(m => m.appointmentId === appointment.id);

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100">
                <div className="text-left">
                    {appointment.date && (
                        <p className="font-semibold text-primary text-base">
                            <span className="text-slate-700">📅 {formatDateDDMMYYYY(appointment.date)}</span>
                            {appointment.time && (
                                <span className="text-slate-700 ml-2">• ⏰ {appointment.time.slice(0, 5)}</span>
                            )}
                        </p>
                    )}
                    {!appointment.date && (
                        <p className="font-semibold text-primary">
                            {formatDateTime(appointment.date, appointment.time) || formatDate(appointment.dateTime) || 'Date not available'}
                        </p>
                    )}
                </div>
                <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isUpcoming ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
                        {isUpcoming ? 'Upcoming' : 'Past'}
                    </span>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
                        <ChevronDown size={20} className="text-slate-500" />
                    </motion.div>
                </div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 space-y-4 bg-white">
                            {appointment.note && (
                                <div>
                                    <h5 className="font-semibold text-slate-600 mb-1">Doctor's Note</h5>
                                    <p className="text-sm text-slate-700 bg-slate-50 p-2 border rounded-md whitespace-pre-wrap">{appointment.note}</p>
                                </div>
                            )}
                            <div>
                                <h5 className="font-semibold text-slate-600 mb-1">Causes</h5>
                                {appointmentCauses.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 bg-slate-50 p-2 border rounded-md">
                                        {appointmentCauses.map(c => {
                                            const causeId = c.id || `${c.appointment_id || c.appointmentId}-${c.cause_id || c.causeId}`;
                                            return (
                                                <li key={causeId}>
                                                    {c.cause_description || c.description || c.cause_name || 'Unknown cause'}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-slate-500">No causes recorded.</p>
                                )}
                            </div>
                            <div>
                                <h5 className="font-semibold text-slate-600 mb-1">Prescriptions</h5>
                                {appointmentMedicates.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 bg-slate-50 p-2 border rounded-md">
                                        {appointmentMedicates.map(m => <li key={m.id}><strong>{m.name}:</strong> {m.description} {m.dose && `(${m.dose})`}</li>)}
                                    </ul>
                                ) : <p className="text-sm text-slate-500">No prescriptions for this visit.</p>}
                            </div>
                            <div>
                                <h5 className="font-semibold text-slate-600 mb-1">Reports</h5>
                                {appointmentDocuments.length > 0 ? (
                                    <div className="space-y-2">
                                        {appointmentDocuments.map(d => (
                                            <a
                                                key={d.id}
                                                href={`http://localhost:5050/documents/${d.id}/pdf`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full text-left p-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm flex items-center space-x-2 cursor-pointer transition-colors"
                                            >
                                                <FileText size={16} className="text-slate-600"/>
                                                <span className="text-slate-700">{d.type} - {formatDate(d.date)}</span>
                                            </a>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-slate-500">No reports available.</p>}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const PatientAppointments = ({ appointments }) => (
    <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-bold text-slate-700 mb-4">Your Appointments</h3>
        {appointments.length > 0 ? (
            <div className="space-y-3">
                {appointments.map(app => (
                    <PatientAppointmentItem key={app.id} appointment={app} />
                ))}
            </div>
        ) : (
            <p className="text-slate-500">You have no appointments on record.</p>
        )}
    </div>
);

const PatientPage = () => {
    const { timeSlots, appointments, bookAppointment, findPatient, getAppointmentsForPatient, patients, addPatient } = useClinic();
    const navigate = useNavigate();

    const [selectedSlot, setSelectedSlot] = useState(null);
    const [loggedInPatient, setLoggedInPatient] = useState(null);
    const [bookingError, setBookingError] = useState('');

    const handleLogin = (name, contact) => {
        const patient = findPatient(name, contact);
        if (patient) {
            setLoggedInPatient(patient);
        } else {
            alert("Patient not found. Please check your details or book a new appointment to register.");
        }
    };
    
    const getPatientAppointmentCount = (patientId, date) => {
        if (!patientId || !date) return 0;
        return appointments.filter(
            a => String(a.patient_id) === String(patientId) && a.date === date
        ).length;
    };

    const handleBookingSubmit = async (patientDetails) => {
        if (!selectedSlot) return;

        setBookingError('');

        // Find or create patient
        let patient = loggedInPatient || findPatient(patientDetails.name, patientDetails.contact);
        
        if (!patient) {
            // Create new patient
            try {
                patient = await addPatient({
                    name: patientDetails.name,
                    continfo: patientDetails.contact,
                    gender: 'Other',
                });
            } catch (error) {
                setBookingError('Failed to create patient record. Please try again.');
                return;
            }
        }

        // Use slot.date directly - it's already YYYY-MM-DD string from ClinicContext
        // Only normalize if absolutely necessary (defensive coding)
        const slotDate = normalizeDateToYMD(selectedSlot.date);
        const slotTime = (selectedSlot.time || '').slice(0, 5); // Extract HH:MM

        // DEBUG: Log date flow to trace any shifts
        console.log('[PatientPage] handleBookingSubmit DEBUG:', {
            selectedSlotRaw: selectedSlot,
            selectedSlotDate: selectedSlot.date,
            selectedSlotDateType: typeof selectedSlot.date,
            normalizedSlotDate: slotDate,
            slotTime: slotTime,
            slotTimeRaw: selectedSlot.time,
        });

        if (!slotDate || !slotTime || !/^\d{2}:\d{2}$/.test(slotTime)) {
            setBookingError('Invalid slot date or time format. Please try selecting the slot again.');
            return;
        }

        console.log('[PatientPage] Booking appointment:', {
            patientId: patient.id,
            date: slotDate,
            time: slotTime,
            status: patientDetails.status || 'Normal'
        });

        // Check appointment limit
        const appointmentCount = getPatientAppointmentCount(patient.id, slotDate);
        if (appointmentCount >= 2) {
            setBookingError('You have reached the maximum number of appointments for this day (2).');
            return;
        }

        // Book appointment
        // For PatientPage, user_id will be null and bookAppointment will fetch a default doctor
        try {
            await bookAppointment(patient.id, slotDate, slotTime, patientDetails.status || 'Normal', null);
            alert("Appointment booked successfully!");
            setSelectedSlot(null);
            setBookingError('');
            
            // Refresh patient data
            const updatedPatient = findPatient(patient.name, patient.continfo || patient.contact);
            if (updatedPatient) {
                setLoggedInPatient(updatedPatient);
            }
        } catch (error) {
            // Handle specific error messages from backend
            let errorMsg = error.message || 'Failed to book appointment. Please try again.';
            
            // Map backend error messages to user-friendly messages
            if (errorMsg.includes('already have an appointment for this time')) {
                errorMsg = 'You already have an appointment for this time.';
            } else if (errorMsg.includes('already booked')) {
                errorMsg = 'This appointment slot is already booked. Please select another time.';
            } else if (errorMsg.includes('maximum number of appointments')) {
                errorMsg = 'You have reached the maximum number of appointments for this day (2).';
            }
            
            setBookingError(errorMsg);
        }
    };

    const patientAppointments = useMemo(() => {
        if (loggedInPatient) {
            return getAppointmentsForPatient(loggedInPatient.id)
                .sort((a, b) => {
                    // String-based sorting: compare date first, then time (NO Date objects)
                    const dateA = normalizeDateToYMD(a.date) || '';
                    const dateB = normalizeDateToYMD(b.date) || '';
                    const dateCompare = dateB.localeCompare(dateA); // Newer dates first
                    if (dateCompare !== 0) return dateCompare;
                    
                    // Same date, compare times (HH:MM format allows direct string comparison)
                    const timeA = (a.time || '').slice(0, 5);
                    const timeB = (b.time || '').slice(0, 5);
                    return timeB.localeCompare(timeA); // Later times first
                });
        }
        return [];
    }, [loggedInPatient, appointments, getAppointmentsForPatient]);

    // Filter slots: only show available (not booked by anyone) and future slots
    // Also exclude slots already booked by the current patient
    // Use normalizeDateToYMD for consistent date handling (NO Date objects)
    const normalizeTimeForSlot = (timeStr) => {
        if (!timeStr) return null;
        return String(timeStr).slice(0, 5); // HH:MM
    };

    const availableSlots = timeSlots.filter(ts => {
        // Must have a valid date (from scheduleconfig)
        if (!ts.date || !ts.configId) return false;
        
        // Must be in the future - use string-based comparison (NO Date objects)
        const slotDate = normalizeDateToYMD(ts.date); // Should already be YYYY-MM-DD, but normalize to be safe
        if (!slotDate) return false;
        
        // Get today's date as YYYY-MM-DD string (local timezone)
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        // Compare dates as strings
        if (slotDate < todayStr) return false; // Past date
        if (slotDate === todayStr) {
            // Same date, check time
            const slotTime = normalizeTimeForSlot(ts.time);
            if (!slotTime) return false;
            const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
            if (slotTime <= nowTime) return false; // Past time today
        }
        
        // Must not be booked by anyone
        if (ts.isBooked) return false;
        
        // If patient is logged in, must not be booked by this patient
        if (loggedInPatient) {
            const slotTime = normalizeTimeForSlot(ts.time);
            
            const patientHasThisSlot = appointments.some(a => {
                const appDate = normalizeDateToYMD(a.date);
                const appTime = normalizeTimeForSlot(a.time);
                return String(a.patient_id) === String(loggedInPatient.id) &&
                       appDate === slotDate &&
                       appTime === slotTime;
            });
            
            if (patientHasThisSlot) return false;
        }
        
        return true;
    });
    
    // Group slots by date to check if schedule exists for each day
    const slotsByDate = availableSlots.reduce((acc, slot) => {
        const date = slot.date;
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(slot);
        return acc;
    }, {});

    if (!loggedInPatient) {
        return (
            <Layout title="Patient Portal">
                <PatientLogin onLogin={handleLogin} />
                <div className="mt-8">
                     <AppointmentBooking
                        title="Or Book a New Appointment"
                        description="If you are a new patient, please select a slot to begin."
                        availableSlots={availableSlots}
                        onSelectSlot={setSelectedSlot}
                    />
                </div>
                 {selectedSlot && (
                    <BookingFormModal
                        isOpen={!!selectedSlot}
                        onClose={() => {
                            setSelectedSlot(null);
                            setBookingError('');
                        }}
                        slot={selectedSlot}
                        onSubmit={handleBookingSubmit}
                        errorMessage={bookingError}
                    />
                )}
            </Layout>
        );
    }

    return (
        <Layout title={`Welcome, ${loggedInPatient.name}`}>
            <div className="flex items-center space-x-3 mb-4">
                 <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                    Returning Patient
                </span>
            </div>
            <div className="space-y-8">
                <PatientAppointments appointments={patientAppointments} />
                <AppointmentBooking
                    title="Book Another Appointment"
                    description="Please select an available time slot below."
                    availableSlots={availableSlots}
                    onSelectSlot={setSelectedSlot}
                />
            </div>
            {selectedSlot && (
                <BookingFormModal
                    isOpen={!!selectedSlot}
                    onClose={() => {
                        setSelectedSlot(null);
                        setBookingError('');
                    }}
                    slot={selectedSlot}
                    onSubmit={handleBookingSubmit}
                    patient={loggedInPatient}
                    errorMessage={bookingError}
                />
            )}
        </Layout>
    );
};

const PatientLogin = ({ onLogin }) => {
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(name, contact);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-md mx-auto">
            <h3 className="text-xl font-bold text-slate-700 mb-1">Returning Patient?</h3>
            <p className="text-slate-500 mb-4">Enter your details to view your upcoming appointments.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Full Name" 
                    className="w-full p-2 border rounded-md" 
                    required 
                />
                <input 
                    type="text" 
                    value={contact} 
                    onChange={e => setContact(e.target.value)} 
                    placeholder="Contact Info (e.g. Email or Phone)" 
                    className="w-full p-2 border rounded-md" 
                    required 
                />
                <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition-colors">
                    View My Appointments
                </button>
            </form>
        </div>
    );
};

const AppointmentBooking = ({
    title,
    description,
    availableSlots,
    onSelectSlot
}) => {
    // Group slots by date using slot.date (YYYY-MM-DD string) - NO Date objects
    const slotsByDay = availableSlots.reduce((acc, slot) => {
        // slot.date is already YYYY-MM-DD string from ClinicContext
        const day = slot.date;
        if (!day) return acc;
        if (!acc[day]) {
            acc[day] = [];
        }
        acc[day].push(slot);
        return acc;
    }, {});

    // Sort days as YYYY-MM-DD strings (direct string comparison works for this format)
    const sortedDays = Object.keys(slotsByDay).sort((a, b) => {
        // YYYY-MM-DD format allows direct string comparison
        return a.localeCompare(b);
    });

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-xl font-bold text-slate-700 mb-1">{title}</h3>
            <p className="text-slate-500 mb-6">{description}</p>
            {sortedDays.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {sortedDays.map(day => {
                        const slots = slotsByDay[day];
                        // Sort slots by time string (HH:MM) - NO Date objects
                        slots.sort((a, b) => {
                            const timeA = (a.time || '').slice(0, 5); // HH:MM
                            const timeB = (b.time || '').slice(0, 5); // HH:MM
                            return timeA.localeCompare(timeB);
                        });
                        return (
                            <div key={day} className="bg-secondary p-4 rounded-xl border border-slate-200 flex flex-col">
                                <h4 className="font-bold text-center text-primary pb-2 mb-3 border-b-2 border-primary-light">
                                    {formatDateLong(day)} {/* day is YYYY-MM-DD string */}
                                </h4>
                                <div className="grid grid-cols-3 gap-2 flex-grow content-start">
                                    {slots.map(ts => {
                                        // Extract time from slot.time (HH:MM format) and format for display
                                        const timeStr = (ts.time || '').slice(0, 5); // HH:MM
                                        const [hours, minutes] = timeStr.split(':').map(Number);
                                        const displayTime = isNaN(hours) || isNaN(minutes) 
                                            ? timeStr 
                                            : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                                        
                                        return (
                                            <motion.button 
                                                key={ts.id} 
                                                onClick={() => onSelectSlot(ts)}
                                                whileHover={{ scale: 1.05, y: -2 }}
                                                whileTap={{ scale: 0.95 }}
                                                className="p-2 bg-teal-50 text-primary font-semibold rounded-lg hover:bg-primary hover:text-white transition-all text-center text-sm shadow-sm"
                                            >
                                                {displayTime}
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="col-span-full text-center py-8 bg-slate-50 rounded-lg">
                    <p className="text-slate-500 font-semibold mb-2">No schedule defined for available days.</p>
                    <p className="text-sm text-slate-400">Please contact the clinic to schedule an appointment or check back later.</p>
                </div>
            )}
        </div>
    );
};

const BookingFormModal = ({ isOpen, onClose, slot, onSubmit, patient, errorMessage }) => {
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [status, setStatus] = useState('Normal');
    const [reason, setReason] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            setReason('');
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const details = patient ? { name: patient.name, contact: patient.continfo || patient.contact } : { name, contact };
        onSubmit({ ...details, status, reason });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Confirm Your Appointment">
            <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg">
                        <p className="font-semibold">⚠️ {errorMessage}</p>
                    </div>
                )}
                <div>
                    <p className="font-semibold text-slate-700">Selected Slot:</p>
                    <p className="p-2 bg-slate-100 rounded-md text-center font-bold text-primary">
                        {formatDateTime(slot.date, slot.time) || formatDate(slot.dateTime)}
                    </p>
                </div>
                {patient ? (
                     <div>
                        <p className="font-semibold text-slate-700">Booking for:</p>
                        <p className="p-2 bg-slate-100 rounded-md">
                           <strong>Name:</strong> {patient.name}<br/>
                           <strong>Contact:</strong> {patient.continfo || patient.contact}
                        </p>
                    </div>
                ) : (
                    <>
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-700">Full Name</label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="mt-1 w-full p-2 border rounded-md"
                                placeholder="e.g., Jane Doe"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="contact" className="block text-sm font-medium text-slate-700">Contact Info (Email or Phone)</label>
                            <input
                                type="text"
                                id="contact"
                                value={contact}
                                onChange={e => setContact(e.target.value)}
                                className="mt-1 w-full p-2 border rounded-md"
                                placeholder="e.g., jane.doe@email.com"
                                required
                            />
                        </div>
                    </>
                )}
                <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">Reason for Visit</label>
                    <textarea
                        id="reason"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        className="w-full p-2 border rounded-md"
                        rows={3}
                        placeholder="Please describe the reason for your appointment..."
                    />
                </div>
                <div>
                    <label htmlFor="status" className="block text-sm font-medium text-slate-700">Case Status</label>
                    <select
                        id="status"
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        className="mt-1 w-full p-2 border rounded-md"
                    >
                        <option value="Normal">Normal</option>
                        <option value="Urgent">Urgent</option>
                    </select>
                </div>
                <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition-colors">Confirm Booking</button>
            </form>
        </Modal>
    );
};


export default PatientPage;

