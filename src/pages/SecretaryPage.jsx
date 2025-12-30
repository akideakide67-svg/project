// src/pages/SecretaryPage.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useClinic } from '../context/ClinicContext';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { Plus, UserPlus, Trash2, Edit, Settings, FileText, Pill, TestTube2, Heart, Search, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDate, formatDateTime, formatDateLong, formatDateForInput } from '../utils/dateFormatter';
import { API as API_BASE_URL } from '../utils/api';

const SecretaryPage = () => {
    const clinic = useClinic();
    const { user } = useAuth();
    const {
        patients,
        addPatient,
        updatePatient,
        deletePatient,
        appointments,
        bookAppointment,
        getSlotsForDate,
        scheduleConfigs,
        timeSlots,
        loadScheduleConfigs,
        deleteScheduleConfig,
    } = clinic;

    const allergies = clinic.allergies || [];
    const vaccins = clinic.vaccins || [];
    const medications = clinic.medications || [];
    const familyHistory = clinic.familyHistory || [];

    const referenceAllergies = clinic.referenceAllergies || [];
    const referenceMedications = clinic.referenceMedications || [];
    const referenceVaccinations = clinic.referenceVaccinations || [];
    const referenceFamilyHistory = clinic.referenceFamilyHistory || [];

    const addAllergy = clinic.addAllergy || (() => {});
    const updateAllergy = clinic.updateAllergy || (() => {});
    const deleteAllergy = clinic.deleteAllergy || (() => {});
    const addVaccin = clinic.addVaccin || (() => {});
    const deleteVaccin = clinic.deleteVaccin || (() => {});
    const addMedication = clinic.addMedication || (() => {});
    const updateMedication = clinic.updateMedication || (() => {});
    const deleteMedication = clinic.deleteMedication || (() => {});
    const addFamilyHistory = clinic.addFamilyHistory || (() => {});
    const updateFamilyHistory = clinic.updateFamilyHistory || (() => {});
    const deleteFamilyHistory = clinic.deleteFamilyHistory || (() => {});

    const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [editingPatient, setEditingPatient] = useState(null);
    const [patientToDelete, setPatientToDelete] = useState(null);
    const [patientForMedicalHistory, setPatientForMedicalHistory] = useState(null);

    // تاريخ اليوم لسحب الـ slots – always keep as local YYYY-MM-DD string
    const [selectedDate, setSelectedDate] = useState(() => {
        const todayLocal = new Date();
        const year = todayLocal.getFullYear();
        const month = String(todayLocal.getMonth() + 1).padStart(2, '0');
        const day = String(todayLocal.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Load slots for a given date using the shared ClinicContext helper
    const loadSlots = useCallback((date) => {
        if (!date) {
            setSlots([]);
            return;
        }

        console.log('[SecretaryPage] loadSlots called with', {
            rawDate: date,
            totalTimeSlots: (timeSlots || []).length,
        });

        const slotsForDate = getSlotsForDate
            ? getSlotsForDate(date)
            : [];

        console.log('[SecretaryPage] loadSlots (via getSlotsForDate) found slotsForDate:', slotsForDate.length);
        setSlots(slotsForDate);
    }, [getSlotsForDate, timeSlots]);

    // Reload slots when selected date, schedule configs, or appointments change
    useEffect(() => {
        console.log('[SecretaryPage] useEffect reloading slots for selectedDate due to deps change', {
            selectedDate,
            scheduleConfigsCount: (scheduleConfigs || []).length,
            appointmentsCount: (appointments || []).length,
            timeSlotsCount: (timeSlots || []).length,
        });
        loadSlots(selectedDate);
    }, [selectedDate, scheduleConfigs, appointments, timeSlots, loadSlots]);

    const handleOpenPatientModal = (patient = null) => {
        setEditingPatient(patient);
        setIsPatientModalOpen(true);
    };

    const handlePatientFormSubmit = (patientData) => {
        if ('id' in patientData) {
            updatePatient(patientData);
        } else {
            addPatient(patientData);
        }
        setIsPatientModalOpen(false);
    };

   const handleConfirmDelete = () => {
  if (patientToDelete) {
    deletePatient(patientToDelete.id);
    setPatientToDelete(null);
  }
};

 const to24Hour = (time) => {
  if (!time) return time;

  const [clock, modifier] = time.split(' ');
  let [hours, minutes] = clock.split(':').map(Number);

  if (modifier === 'PM' && hours !== 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const handleDeleteSchedule = async () => {
    try {
        // Find the schedule config for the selected date to get its ID
        const configToDelete = scheduleConfigs.find(sc => sc.date === selectedDate);
        
        if (!configToDelete || !configToDelete.id) {
            alert('Schedule config not found for the selected date');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete the schedule for ${selectedDate}?`)) {
            return;
        }

        // Use the context function which handles state updates
        await deleteScheduleConfig(configToDelete.id);

        // Reload slots for the selected date (will now be empty since config is deleted)
        loadSlots(selectedDate);

        alert('Schedule deleted successfully');
    } catch (err) {
        console.error('Error deleting schedule:', err);
        alert('Failed to delete schedule: ' + (err.message || err));
    }
};

const handleScheduleSubmit = async (config) => {
  try {
    // Normalize date helper (local YYYY-MM-DD only)
    const normalizeDate = (value) => {
      if (!value) return null;
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.slice(0, 10);
      }
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Save schedule configs to backend
    for (const date of config.selectedDates) {
      const response = await fetch(`${API_BASE_URL}/scheduleconfig`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          starttime: to24Hour(config.startTime),
          endtime: to24Hour(config.endTime),
          time_interval: config.appointmentDuration,
          buffer: config.bufferBetween,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save schedule config');
      }

      console.log('[SecretaryPage] Saved schedule config for date', date);
    }

    // Close the modal
    setIsScheduleModalOpen(false);

    // Refresh schedule configs from backend to update timeSlots
    if (loadScheduleConfigs) {
      const newConfigs = await loadScheduleConfigs();
      console.log('[SecretaryPage] loadScheduleConfigs completed. Count:', Array.isArray(newConfigs) ? newConfigs.length : 'n/a');
    }

    // Re-synchronize selectedDate: normalize current selectedDate or use first saved date
    const normalizedSelectedDate = normalizeDate(selectedDate);
    const normalizedSavedDates = config.selectedDates.map(d => normalizeDate(d));
    
    // If current selectedDate is in the saved dates, keep it (normalized)
    // Otherwise, set it to the first saved date
    const targetDate = normalizedSavedDates.includes(normalizedSelectedDate)
      ? normalizedSelectedDate
      : (normalizedSavedDates[0] || normalizedSelectedDate);

    console.log('[SecretaryPage] Re-synchronizing selectedDate after save', {
      previousSelectedDate: selectedDate,
      normalizedPrevious: normalizedSelectedDate,
      savedDates: normalizedSavedDates,
      targetDate,
    });

    // Force re-set selectedDate to ensure state and date picker stay synchronized
    setSelectedDate(targetDate);

    // Reload slots for the normalized target date (this will use the updated timeSlots)
    console.log('[SecretaryPage] Calling loadSlots after schedule save for targetDate:', targetDate);
    loadSlots(targetDate);

  } catch (err) {
    console.error('Error saving schedule config:', err);
    alert('Failed to save schedule config on server: ' + (err.message || err));
  }
};


    return (
        <Layout title="Secretary Dashboard">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Patients Section */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-slate-700">Patients</h3>
                        <button
                            onClick={() => handleOpenPatientModal()}
                            className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
                        >
                            <UserPlus size={20} />
                            <span>Add Patient</span>
                        </button>
                    </div>
                    <PatientList
                        patients={patients}
                        onEdit={handleOpenPatientModal}
                        onDelete={setPatientToDelete}
                        onManageMedicalHistory={setPatientForMedicalHistory}
                    />
                </div>

                {/* Time Slots & Booking Section */}
                <div className="space-y-8">
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h3 className="text-xl font-bold text-slate-700 mb-4">Doctor&apos;s Schedule</h3>
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <input
                                type="date"
                                value={selectedDate || ''}
                                onChange={(e) => {
                                    // Date picker returns YYYY-MM-DD string directly, use it as-is
                                    const newDate = e.target.value;
                                    console.log('[SecretaryPage] Date picker changed', {
                                        previousSelectedDate: selectedDate,
                                        newDateFromPicker: newDate,
                                        isSame: selectedDate === newDate,
                                    });
                                    setSelectedDate(newDate);
                                }}
                                className="border rounded-md px-2 py-1 text-sm"
                            />
                            <button
                                onClick={() => setIsScheduleModalOpen(true)}
                                className="flex items-center space-x-2 bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary-dark transition-colors"
                            >
                                <Settings size={18} />
                                <span>Configure</span>
                            </button>
                            {/* Delete Schedule button - only show if schedule exists for selected date */}
                            {scheduleConfigs && scheduleConfigs.some(sc => sc.date === selectedDate) && (
                                <button
                                    onClick={handleDeleteSchedule}
                                    className="flex items-center space-x-2 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    <Trash2 size={18} />
                                    <span>Delete Schedule</span>
                                </button>
                            )}
                        </div>
                        <TimeSlotList
                            slots={slots}
                            appointments={appointments}
                            patients={patients}
                            loading={loadingSlots}
                        />
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h3 className="text-xl font-bold text-slate-700 mb-4">Book Appointment</h3>
                        <button
                            onClick={() => setIsBookingModalOpen(true)}
                            className="w-full flex items-center justify-center space-x-2 bg-accent text-white px-4 py-3 rounded-lg hover:bg-amber-600 transition-colors font-semibold"
                        >
                            <Plus size={20} />
                            <span>New Booking</span>
                        </button>
                    </div>
                </div>
            </div>

            <PatientFormModal
                isOpen={isPatientModalOpen}
                onClose={() => setIsPatientModalOpen(false)}
                onSubmit={handlePatientFormSubmit}
                patient={editingPatient}
            />

            <ScheduleConfigModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                onSubmit={handleScheduleSubmit}
                currentConfig={null}
                selectedDate={selectedDate}
            />

            <BookingModal
                isOpen={isBookingModalOpen}
                onClose={() => setIsBookingModalOpen(false)}
                patients={patients}
                slots={slots}
                appointments={appointments}
                selectedDate={selectedDate}
                bookAppointment={bookAppointment}
            />

            <Modal
                isOpen={!!patientToDelete}
                onClose={() => setPatientToDelete(null)}
                title="Confirm Patient Deletion"
                size="sm"
            >
                {patientToDelete && (
                    <div className="text-center p-4">
                        <p className="text-slate-700">
                            Are you sure you want to delete the patient{' '}
                            <strong className="font-semibold">{patientToDelete.name}</strong>?
                        </p>
                        <p className="mt-2 text-sm text-slate-500 bg-amber-50 p-3 rounded-lg">
                            This will also cancel all their associated appointments. This action cannot be undone.
                        </p>
                        <div className="mt-6 flex justify-center space-x-4">
                            <button
                                onClick={() => setPatientToDelete(null)}
                                className="px-6 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {patientForMedicalHistory && (
                <MedicalHistoryModal
                    isOpen={!!patientForMedicalHistory}
                    onClose={() => setPatientForMedicalHistory(null)}
                    patient={patientForMedicalHistory}
                    allergies={allergies.filter(a => a.patientId === patientForMedicalHistory.id)}
                    vaccins={vaccins.filter(v => v.patientId === patientForMedicalHistory.id)}
                    medications={medications.filter(m => m.patientId === patientForMedicalHistory.id)}
                    familyHistory={familyHistory.filter(fh => fh.patientId === patientForMedicalHistory.id)}
                    referenceAllergies={referenceAllergies}
                    referenceMedications={referenceMedications}
                    referenceVaccinations={referenceVaccinations}
                    referenceFamilyHistory={referenceFamilyHistory}
                    onAddAllergy={addAllergy}
                    onUpdateAllergy={updateAllergy}
                    onDeleteAllergy={deleteAllergy}
                    onAddVaccin={addVaccin}
                    onDeleteVaccin={deleteVaccin}
                    onAddMedication={addMedication}
                    onUpdateMedication={updateMedication}
                    onDeleteMedication={deleteMedication}
                    onAddFamilyHistory={addFamilyHistory}
                    onUpdateFamilyHistory={updateFamilyHistory}
                    onDeleteFamilyHistory={deleteFamilyHistory}
                />
            )}
        </Layout>
    );
};

const PatientList = ({ patients, onEdit, onDelete, onManageMedicalHistory }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left">
            <thead className="border-b-2">
                <tr>
                    <th className="p-2">Name</th>
                    <th className="p-2">DoB</th>
                    <th className="p-2">Contact</th>
                    <th className="p-2">Actions</th>
                </tr>
            </thead>
            <tbody>
                {patients.map(p => (
                    <motion.tr
                        key={p.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b hover:bg-slate-50"
                    >
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3 text-slate-600">{formatDate(p.dob)}</td>
                        <td className="p-3 text-slate-600">{p.continfo || p.contact}</td>
                        <td className="p-3 flex items-center space-x-2">
                            <button
                                onClick={() => onEdit(p)}
                                className="text-primary hover:text-primary-dark p-1"
                                title="Edit Patient"
                            >
                                <Edit size={18} />
                            </button>
                            <button
                                onClick={() => onManageMedicalHistory(p)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Manage Medical History"
                            >
                                <FileText size={18} />
                            </button>
                            <button
                                onClick={() => onDelete(p)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Delete Patient"
                            >
                                <Trash2 size={18} />
                            </button>
                        </td>
                    </motion.tr>
                ))}
            </tbody>
        </table>
    </div>
);

const TimeSlotList = ({ slots, appointments, patients, loading }) => {
    if (loading) {
        return (
            <p className="text-slate-500 text-center py-4 flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                <span>Loading slots...</span>
            </p>
        );
    }

    // Normalize date helper (LOCAL date, not UTC)
    const normalizeDate = (value) => {
        if (!value) return null;
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            return value.slice(0, 10);
        }
        const d = value instanceof Date ? value : new Date(value);
        if (isNaN(d.getTime())) return null;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (!slots || slots.length === 0) {
        return (
            <p className="text-slate-500 text-center py-4">
                No schedule defined for this day. Configure the schedule to generate slots.
            </p>
        );
    }

    // Filter and group slots using string-based date comparison (NO Date objects)
    // slot.date is already YYYY-MM-DD string from ClinicContext
    const normalizeDateForSlot = (dateStr) => {
        if (!dateStr) return null;
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return dateStr.slice(0, 10);
        }
        return null;
    };

    // Get today as YYYY-MM-DD string for comparison
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

    const slotsByDay = slots
        .filter(ts => {
            if (!ts.date) return false;
            const slotDate = normalizeDateForSlot(ts.date);
            if (!slotDate) return false;
            
            // Filter out past slots using string comparison
            if (slotDate < todayStr) return false;
            if (slotDate === todayStr) {
                const slotTime = (ts.time || '').slice(0, 5);
                if (!slotTime || slotTime <= nowTime) return false;
            }
            return true;
        })
        .reduce((acc, slot) => {
            // Use slot.date (YYYY-MM-DD string) directly for grouping
            const day = normalizeDateForSlot(slot.date);
            if (!day) return acc;
            if (!acc[day]) {
                acc[day] = [];
            }
            acc[day].push(slot);
            return acc;
        }, {});

    return (
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {Object.entries(slotsByDay).map(([day, daySlots]) => (
                <div key={day}>
                    <h4 className="font-semibold text-slate-600 bg-slate-100 p-2 rounded-t-md sticky top-0">
                        {formatDateLong(day)}
                    </h4>
                    <ul className="space-y-1 p-2 border border-t-0 rounded-b-md">
                        {daySlots.map(ts => {
                            // Normalize dates and times for comparison
                            const normalizeTime = (time) => {
                                if (!time) return null;
                                return String(time).slice(0, 5);
                            };
                            
                            const slotDate = normalizeDate(ts.date);
                            const slotTime = normalizeTime(ts.time);
                            
                            const appointment = appointments.find(a => {
                                const appDate = normalizeDate(a.date);
                                const appTime = normalizeTime(a.time);
                                return appDate === slotDate && appTime === slotTime;
                            });

                            const isBooked = !!appointment;
                            const isUrgent = appointment?.status === 'Urgent';
                            const patientName = appointment
                                ? (patients.find(p => p.id === appointment.patient_id)?.name || 'Patient')
                                : null;

                            let liClassName = 'flex justify-between items-center p-2 rounded-md transition-colors';
                            if (isUrgent) {
                                liClassName += ' bg-red-200 border-l-4 border-red-500';
                            } else if (isBooked) {
                                liClassName += ' bg-red-100';
                            } else {
                                liClassName += ' bg-green-50';
                            }

                            return (
                                <li key={ts.id || `${ts.date}-${ts.time}`} className={liClassName}>
                                    <span
                                        className={`font-medium ${isBooked ? 'text-slate-800' : 'text-green-700'}`}
                                    >
                                        {(ts.time || '').slice(0, 5) || 'N/A'}
                                    </span>
                                    {patientName && (
                                        <span
                                            className={`font-semibold ${
                                                isUrgent ? 'text-red-700' : 'text-slate-700'
                                            }`}
                                        >
                                            {patientName}
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
};

const PatientFormModal = ({ isOpen, onClose, onSubmit, patient }) => {
    // Get today's date as YYYY-MM-DD string for max attribute
    const getTodayDateString = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [formData, setFormData] = useState(
        patient
            ? {
                  name: patient.name || '',
                  dob: patient.dob || '',
                  gender: patient.gender || 'Other',
                  contact: patient.continfo || patient.contact || '',
              }
            : {
                  name: '',
                  dob: '',
                  gender: 'Other',
                  contact: '',
              }
    );
    const [dobError, setDobError] = useState('');

    useEffect(() => {
        if (patient) {
            setFormData({
                name: patient.name || '',
                dob: patient.dob || '',
                gender: patient.gender || 'Other',
                contact: patient.continfo || patient.contact || '',
            });
        } else {
            setFormData({
                name: '',
                dob: '',
                gender: 'Other',
                contact: '',
            });
        }
        setDobError(''); // Clear error when modal opens/closes
    }, [patient, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user changes the date
        if (name === 'dob') {
            setDobError('');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validate Date of Birth - must be in the past
        const dobValue = formatDateForInput(formData.dob);
        if (dobValue) {
            const todayStr = getTodayDateString();
            // Compare dates as strings (YYYY-MM-DD format allows direct string comparison)
            if (dobValue > todayStr) {
                setDobError('Date of birth cannot be in the future.');
                return; // Prevent form submission
            }
        }
        
        setDobError(''); // Clear any previous errors
        const submitData = {
            ...formData,
            continfo: formData.contact,
        };
        delete submitData.contact;
        onSubmit(patient ? { ...submitData, id: patient.id } : submitData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={patient ? 'Edit Patient' : 'Add New Patient'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                <h4 className="font-bold text-lg border-b pb-2">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Full Name"
                        className="p-2 border rounded-md"
                        required
                    />
                    <div>
                        <input
                            type="date"
                            name="dob"
                            value={formatDateForInput(formData.dob)}
                            onChange={handleChange}
                            max={getTodayDateString()}
                            className={`p-2 border rounded-md w-full ${dobError ? 'border-red-500' : ''}`}
                            required
                        />
                        {dobError && (
                            <p className="text-red-600 text-sm mt-1">{dobError}</p>
                        )}
                    </div>
                    <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className="p-2 border rounded-md"
                    >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                    </select>
                    <input
                        name="contact"
                        value={formData.contact}
                        onChange={handleChange}
                        placeholder="Contact Info"
                        className="p-2 border rounded-md"
                        required
                    />
                </div>
                <p className="text-sm text-slate-500">
                    Note: Medical history (allergies, vaccines, medications, family history) can be added separately
                    after creating the patient.
                </p>
                <button
                    type="submit"
                    className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition-colors"
                >
                    {patient ? 'Update Patient' : 'Save Patient'}
                </button>
            </form>
        </Modal>
    );
};

const ScheduleConfigModal = ({ isOpen, onClose, onSubmit, currentConfig, selectedDate }) => {
    const [config, setConfig] = useState({
        selectedDates: [],
        startTime: '09:00',
        endTime: '17:00',
        appointmentDuration: 30,
        bufferBetween: 5,
    });
    const [newDate, setNewDate] = useState('');

    useEffect(() => {
        if (isOpen) {
            const sc = currentConfig || {};
            // Get today's date as LOCAL YYYY-MM-DD string (no Date object conversion via toISOString)
            const todayLocal = new Date();
            const today = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
            // If selectedDate is provided and no currentConfig, pre-fill with selectedDate
            const dates = sc.selectedDates || (sc.date ? [sc.date] : (selectedDate ? [selectedDate] : []));
            const validDates = dates.filter(date => date >= today);
            setConfig({
                selectedDates: validDates,
                startTime: sc.startTime || sc.starttime || '09:00',
                endTime: sc.endTime || sc.endtime || '17:00',
                appointmentDuration: sc.appointmentDuration || sc.interval || 30,
                bufferBetween: sc.bufferBetween ?? sc.buffer ?? 5,
            });
            setNewDate('');
        }
    }, [isOpen, currentConfig, selectedDate]);

    const handleConfigChange = (e) => {
        const { name, value } = e.target;
        if (name === 'appointmentDuration' || name === 'bufferBetween') {
            setConfig(prev => ({ ...prev, [name]: Math.max(0, parseInt(value) || 0) }));
        } else {
            setConfig(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAddDate = () => {
        if (!newDate) return;
        // Get today's date as LOCAL YYYY-MM-DD string (no Date object conversion via toISOString)
        const todayLocal = new Date();
        const today = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
        if (newDate < today) {
            alert('Cannot add past dates. Please select today or a future date.');
            return;
        }
        setConfig(prev => {
            const existingDates = prev.selectedDates || [];
            if (existingDates.includes(newDate)) return prev;
            const updated = [...existingDates, newDate].sort();
            return { ...prev, selectedDates: updated };
        });
        setNewDate('');
    };

    const handleRemoveDate = (dateToRemove) => {
        setConfig(prev => ({
            ...prev,
            selectedDates: (prev.selectedDates || []).filter(d => d !== dateToRemove),
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (config.startTime >= config.endTime) {
            alert('Start time must be before end time.');
            return;
        }
        if (!config.selectedDates || config.selectedDates.length === 0) {
            alert('Please choose at least one appointment date.');
            return;
        }
        if (!config.appointmentDuration || config.appointmentDuration <= 0) {
            alert('Appointment duration must be greater than zero.');
            return;
        }
        onSubmit(config);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configure Schedule" size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block font-semibold text-slate-700 mb-2">Appointment Dates</label>
                    <div className="flex flex-col md:flex-row gap-4">
                        <input
                            type="date"
                            value={newDate || ''}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="flex-1 p-2 border rounded-md"
                            min={(() => {
                                // Get today's date as LOCAL YYYY-MM-DD string (no Date object conversion)
                                const todayLocal = new Date();
                                return `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
                            })()}
                        />
                        <button
                            type="button"
                            onClick={handleAddDate}
                            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors font-semibold"
                        >
                            Add Date
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {(config.selectedDates || []).map(date => (
                            <span
                                key={date}
                                className="flex items-center space-x-2 bg-slate-100 px-3 py-1 rounded-full text-sm"
                            >
                                <span>{formatDate(date)}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveDate(date)}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        {(config.selectedDates || []).length === 0 && (
                            <span className="text-sm text-slate-500">No dates selected yet.</span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="startTime" className="block font-semibold text-slate-700 mb-1">
                            Daily Start Time
                        </label>
                        <input
                            type="time"
                            id="startTime"
                            name="startTime"
                            value={config.startTime}
                            onChange={handleConfigChange}
                            className="w-full p-2 border rounded-md"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="endTime" className="block font-semibold text-slate-700 mb-1">
                            Daily End Time
                        </label>
                        <input
                            type="time"
                            id="endTime"
                            name="endTime"
                            value={config.endTime}
                            onChange={handleConfigChange}
                            className="w-full p-2 border rounded-md"
                            required
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="appointmentDuration" className="block font-semibold text-slate-700 mb-1">
                            Appointment Duration (minutes)
                        </label>
                        <input
                            type="number"
                            id="appointmentDuration"
                            name="appointmentDuration"
                            value={config.appointmentDuration}
                            onChange={handleConfigChange}
                            className="w-full p-2 border rounded-md"
                            required
                            min="5"
                            step="5"
                        />
                    </div>
                    <div>
                        <label htmlFor="bufferBetween" className="block font-semibold text-slate-700 mb-1">
                            Buffer Between Appointments (minutes)
                        </label>
                        <input
                            type="number"
                            id="bufferBetween"
                            name="bufferBetween"
                            value={config.bufferBetween}
                            onChange={handleConfigChange}
                            className="w-full p-2 border rounded-md"
                            min="0"
                            step="5"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary-dark transition-colors font-semibold"
                >
                    Generate &amp; Save Schedule
                </button>
            </form>
        </Modal>
    );
};

const BookingModal = ({ isOpen, onClose, patients, slots, appointments, selectedDate, bookAppointment }) => {
    const { user } = useAuth();
    const [patientId, setPatientId] = useState('');
    const [slotKey, setSlotKey] = useState('');
    const [status, setStatus] = useState('Normal');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPatientId('');
            setSlotKey('');
            setStatus('Normal');
            setErrorMessage('');
        }
    }, [isOpen]);

    // Reset slotKey when selectedDate changes to prevent stale value in controlled select
    useEffect(() => {
        setSlotKey('');
    }, [selectedDate]);

    // Normalize dates and times for comparison (LOCAL date)
    // CRITICAL: YYYY-MM-DD strings must be returned directly, never wrapped in new Date()
    const normalizeDateForSlot = (value) => {
        if (!value) return null;
        // PRIORITY 1: Exact YYYY-MM-DD string match - return immediately (no Date object)
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }
        // PRIORITY 2: String starting with YYYY-MM-DD - extract first 10 chars
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            return value.slice(0, 10);
        }
        // PRIORITY 3: Date object - use LOCAL methods (not UTC)
        if (value instanceof Date) {
            if (isNaN(value.getTime())) return null;
            const year = value.getFullYear(); // LOCAL year
            const month = String(value.getMonth() + 1).padStart(2, '0'); // LOCAL month
            const day = String(value.getDate()).padStart(2, '0'); // LOCAL day
            return `${year}-${month}-${day}`;
        }
        // Last resort: try to parse as Date (should be rare)
        try {
            const d = new Date(value);
            if (isNaN(d.getTime())) return null;
            const year = d.getFullYear(); // LOCAL year
            const month = String(d.getMonth() + 1).padStart(2, '0'); // LOCAL month
            const day = String(d.getDate()).padStart(2, '0'); // LOCAL day
            return `${year}-${month}-${day}`;
        } catch (e) {
            return null;
        }
    };
    
    const normalizeTimeForSlot = (time) => {
        if (!time) return null;
        return String(time).slice(0, 5);
    };

    // Filter slots to only show available ones (not booked and in the future)
    const availableSlots = (slots || []).filter(slot => {
        if (!slot || !slot.date || !slot.time || !slot.dateTime) {
            console.warn('[BookingModal] Invalid slot in availableSlots filter:', slot);
            return false;
        }

        // Check if slot is in the future by comparing date+time strings, not Date objects
        // This avoids timezone issues
        const slotDate = normalizeDateForSlot(slot.date);
        const slotTime = normalizeTimeForSlot(slot.time);
        const now = new Date();
        const today = normalizeDateForSlot(now);
        const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        // If slot date is in the past, exclude it
        if (slotDate < today) return false;
        
        // If slot date is today, check if time is in the past
        if (slotDate === today && slotTime <= nowTime) return false;
        
        // Check if slot is already booked
        const hasAppointment = appointments?.some(a => {
            const appDate = normalizeDateForSlot(a.date);
            const appTime = normalizeTimeForSlot(a.time);
            return appDate === slotDate && appTime === slotTime;
        });

        return !hasAppointment;
    });

    // Count patient's appointments for the selected date
    const getPatientAppointmentCount = (patientId, date) => {
        if (!patientId || !date) return 0;
        return appointments.filter(
            a => String(a.patient_id) === String(patientId) && a.date === date
        ).length;
    };

    // Normalize date for comparison (LOCAL date)
    const normalizeDateForComparison = (value) => {
      if (!value) return null;
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.slice(0, 10);
      }
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const normalizedSelectedDate = normalizeDateForComparison(selectedDate);
    console.log('[BookingModal] render with', {
      rawSelectedDate: selectedDate,
      normalizedSelectedDate,
      totalSlots: (slots || []).length,
      availableSlots: availableSlots.length,
    });

    // Check if there's a schedule config for the selected date
    // If slots exist (even if all are booked), then schedule config exists
    // Slots are generated from scheduleConfigs, so if slots.length === 0, there's no scheduleconfig for this date
    const hasScheduleForDate = (slots || []).length > 0;

    // Get available slots for selected date (only from schedule config, not booked)
    const slotsForSelectedDate = availableSlots.filter(slot => {
      if (!slot || !slot.date) {
        console.warn('[BookingModal] Slot missing date:', slot);
        return false;
      }
      const slotDate = normalizeDateForComparison(slot.date);
      return slotDate === normalizedSelectedDate;
    });
    
    console.log('[BookingModal] slotsForSelectedDate', {
      length: slotsForSelectedDate.length,
      sample: slotsForSelectedDate.slice(0, 3).map(s => ({
        id: s.id,
        date: s.date,
        time: s.time,
        dateTime: s.dateTime,
        hasAllFields: !!(s.id && s.date && s.time && s.dateTime),
      })),
    });

    // Check if patient has reached limit when slot is selected
    useEffect(() => {
        if (patientId && slotKey) {
            const [date] = slotKey.split('|');
            const count = getPatientAppointmentCount(patientId, date);
            if (count >= 2) {
                setErrorMessage('You have reached the maximum number of appointments for this day (2).');
                setSlotKey(''); // Clear slot selection
            } else {
                setErrorMessage('');
            }
        } else {
            setErrorMessage('');
        }
    }, [patientId, slotKey, appointments]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!patientId || !slotKey) {
            setErrorMessage('Please select both a patient and a time slot.');
            return;
        }

        const [date, time] = slotKey.split('|');
        
        // Final check before submitting
        const count = getPatientAppointmentCount(patientId, date);
        if (count >= 2) {
            setErrorMessage('You have reached the maximum number of appointments for this day (2).');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
        // Use logged-in user's id (should be Secretary or Doctor)
        const userId = user?.id || null;
        await bookAppointment(patientId, date, time, status, userId);
        onClose();
        } catch (error) {
            // Handle server validation errors
            const errorMsg = error.message || 'Failed to book appointment. Please try again.';
            setErrorMessage(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Show appointment count for selected patient and date
    const appointmentCount = patientId && slotKey 
        ? getPatientAppointmentCount(patientId, slotKey.split('|')[0])
        : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Book Appointment">
            <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg">
                        <p className="font-semibold">⚠️ {errorMessage}</p>
                    </div>
                )}

                <div>
                    <label htmlFor="patient" className="block text-sm font-medium text-slate-700">
                        Patient
                    </label>
                    <select
                        id="patient"
                        value={patientId}
                        onChange={e => {
                            setPatientId(e.target.value);
                            setSlotKey(''); // Clear slot when patient changes
                            setErrorMessage('');
                        }}
                        className="w-full p-2 border rounded-md mt-1"
                        required
                    >
                        <option value="">Select Patient</option>
                        {patients.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="timeslot" className="block text-sm font-medium text-slate-700">
                        Time Slot ({selectedDate})
                    </label>
                    {!hasScheduleForDate ? (
                        <div className="mt-1 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md">
                            <p className="text-sm font-semibold">No schedule defined for this day.</p>
                            <p className="text-xs mt-1">Please configure the schedule for this date to generate appointment slots.</p>
                        </div>
                    ) : slotsForSelectedDate.length === 0 ? (
                        <div className="mt-1 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md">
                            <p className="text-sm">All available slots for this date are booked.</p>
                        </div>
                    ) : (
                    <select
                        id="timeslot"
                        value={slotKey || ""}
                        onChange={e => setSlotKey(e.target.value)}
                        className={`w-full p-2 border rounded-md mt-1 ${errorMessage ? 'border-red-500' : ''}`}
                        required
                        disabled={!patientId || slotsForSelectedDate.length === 0}
                    >
                        <option value="">Select Time Slot</option>
                        {slotsForSelectedDate.length > 0 ? (
                            slotsForSelectedDate.map((ts, index) => {
                                // Ensure all required fields exist
                                if (!ts || !ts.date || !ts.time || !ts.dateTime) {
                                    console.warn('[BookingModal] Invalid slot data:', ts);
                                    return null;
                                }
                                
                                const optionValue = `${ts.date}|${ts.time}`;
                                const optionKey = ts.id || `${ts.date}-${ts.time}-${index}`;
                                
                                // Extract time from slot.time (HH:MM format) - NO Date objects
                                const timeDisplay = (ts.time || '').slice(0, 5) || '';
                                
                                return (
                                    <option key={optionKey} value={optionValue}>
                                        {timeDisplay}
                                    </option>
                                );
                            }).filter(Boolean) // Remove any null entries
                        ) : (
                            <option value="" disabled>No slots available</option>
                        )}
                    </select>
                    )}
                    {patientId && slotKey && (
                        <p className="text-xs text-slate-600 mt-1">
                            Patient has {appointmentCount} appointment(s) on this date. (Maximum: 2)
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="status" className="block text-sm font-medium text-slate-700">
                        Case Status
                    </label>
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

                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg text-sm">
                    <p className="font-semibold mb-1">📋 Appointment Rules:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Maximum 2 appointments per patient per day</li>
                        <li>Slots are generated from schedule configuration only</li>
                        <li>Booked slots become unavailable immediately</li>
                    </ul>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || !patientId || !slotKey || !!errorMessage || !hasScheduleForDate}
                    className={`w-full py-2 rounded-lg transition-colors ${
                        isSubmitting || !patientId || !slotKey || !!errorMessage || !hasScheduleForDate
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                    title={!hasScheduleForDate ? 'No schedule configured for this date' : ''}
                >
                    {isSubmitting ? 'Booking...' : 'Book Appointment'}
                </button>
            </form>
        </Modal>
    );
};

// الباقي: MedicalHistoryModal + MedicalHistoryFormModal + ICD10Dropdown
// نفس ما عندك (ما عدّلت فيهن ولا حرف)

const MedicalHistoryModal = ({
    isOpen,
    onClose,
    patient,
    allergies,
    vaccins,
    medications,
    familyHistory,
    referenceAllergies,
    referenceMedications,
    referenceVaccinations,
    referenceFamilyHistory,
    onAddAllergy,
    onUpdateAllergy,
    onDeleteAllergy,
    onAddVaccin,
    onDeleteVaccin,
    onAddMedication,
    onUpdateMedication,
    onDeleteMedication,
    onAddFamilyHistory,
    onUpdateFamilyHistory,
    onDeleteFamilyHistory,
}) => {
    const [activeTab, setActiveTab] = useState('allergies');
    const [editingItem, setEditingItem] = useState(null);
    const [editingType, setEditingType] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});

    const handleAdd = (type) => {
        setEditingType(type);
        setEditingItem(null);
        setValidationErrors({});
    };

    const handleEdit = (item, type) => {
        setEditingItem(item);
        setEditingType(type);
        setValidationErrors({});
    };

    const handleSave = (data, type) => {
        // Validate required fields
        const errors = {};
        if (!data.allergy_id && type === 'allergy') errors.allergy_id = 'Please select an allergy from the database';
        if (!data.vaccin_id && type === 'vaccin') errors.vaccin_id = 'Please select a vaccination from the database';
        if (!data.medication_id && type === 'medication') errors.medication_id = 'Please select a medication from the database';
        if (!data.familyhistory_id && type === 'familyHistory') errors.familyhistory_id = 'Please select a family history from the database';
        if (!data.level && type === 'familyHistory') errors.level = 'Please select a degree of relation';

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        setValidationErrors({});
        if (editingItem) {
            if (type === 'allergy') onUpdateAllergy({ ...editingItem, ...data });
            else if (type === 'medication') onUpdateMedication({ ...editingItem, ...data });
            else if (type === 'familyHistory') onUpdateFamilyHistory({ ...editingItem, ...data });
            // Note: Vaccins don't have update, only add/delete
        } else {
            const newItem = { ...data, patientId: patient.id };
            if (type === 'allergy') onAddAllergy(newItem);
            else if (type === 'vaccin') onAddVaccin(newItem);
            else if (type === 'medication') onAddMedication(newItem);
            else if (type === 'familyHistory') onAddFamilyHistory(newItem);
        }
        setEditingItem(null);
        setEditingType(null);
    };

    const handleCancel = () => {
        setEditingItem(null);
        setEditingType(null);
        setValidationErrors({});
    };

    const tabs = [
        { id: 'allergies', label: 'Allergies', icon: <TestTube2 size={18} /> },
        { id: 'vaccins', label: 'Vaccines', icon: <Pill size={18} /> },
        { id: 'medications', label: 'Medications', icon: <Pill size={18} /> },
        { id: 'familyHistory', label: 'Family History', icon: <Heart size={18} /> },
    ];

    const renderTabContent = () => {
        if (editingType || editingItem) {
            let formType = editingType;
            if (!formType && editingItem) {
                if (editingItem.allergy_id) formType = 'allergy';
                else if (editingItem.vaccin_id) formType = 'vaccin';
                else if (editingItem.medication_id) formType = 'medication';
                else if (editingItem.familyhistory_id) formType = 'familyHistory';
            }
            return (
                <MedicalHistoryFormModal
                    type={formType}
                    item={editingItem}
                    referenceAllergies={referenceAllergies}
                    referenceMedications={referenceMedications}
                    referenceVaccinations={referenceVaccinations}
                    referenceFamilyHistory={referenceFamilyHistory}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    validationErrors={validationErrors}
                />
            );
        }

        switch (activeTab) {
            case 'allergies':
                return (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-lg">Allergies</h4>
                            <button
                                onClick={() => handleAdd('allergy')}
                                className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
                            >
                                <Plus size={18} />
                                <span>Add Allergy</span>
                            </button>
                        </div>
                        {allergies.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">No allergies recorded. Click "Add Allergy" to add one.</p>
                        ) : (
                            <div className="space-y-2">
                                {allergies.map(a => (
                                    <div key={a.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <span className="font-medium">{a.name}</span>
                                        <div className="flex space-x-2">
                                            <button onClick={() => handleEdit(a, 'allergy')} className="text-blue-600 hover:text-blue-800">
                                                <Edit size={18} />
                                            </button>
                                            <button onClick={() => onDeleteAllergy(a.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'vaccins':
                return (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-lg">Vaccinations</h4>
                            <button
                                onClick={() => handleAdd('vaccin')}
                                className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
                            >
                                <Plus size={18} />
                                <span>Add Vaccination</span>
                            </button>
                        </div>
                        {vaccins.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">No vaccinations recorded. Click "Add Vaccination" to add one.</p>
                        ) : (
                            <div className="space-y-2">
                                {vaccins.map(v => (
                                    <div key={v.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <span className="font-medium">{v.name}</span>
                                            {v.date && <span className="text-sm text-slate-600 ml-2">({v.date})</span>}
                                        </div>
                                        <div className="flex space-x-2">
                                            <button onClick={() => onDeleteVaccin(v.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'medications':
                return (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-lg">Medications</h4>
                            <button
                                onClick={() => handleAdd('medication')}
                                className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
                            >
                                <Plus size={18} />
                                <span>Add Medication</span>
                            </button>
                        </div>
                        {medications.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">No medications recorded. Click "Add Medication" to add one.</p>
                        ) : (
                            <div className="space-y-2">
                                {medications.map(m => (
                                    <div key={m.id} className="p-3 bg-slate-50 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{m.name}</span>
                                                    {m.dose && <span className="text-sm text-slate-600">Dose: {m.dose}</span>}
                                                </div>
                                                {m.description && (
                                                    <p className="text-sm text-slate-600 mt-1 italic">{m.description}</p>
                                                )}
                                                {m.delay && (
                                                    <p className="text-xs text-slate-500 mt-1">Delay: {m.delay}</p>
                                                )}
                                            </div>
                                            <div className="flex space-x-2 ml-4">
                                                <button onClick={() => handleEdit(m, 'medication')} className="text-blue-600 hover:text-blue-800">
                                                    <Edit size={18} />
                                                </button>
                                                <button onClick={() => onDeleteMedication(m.id)} className="text-red-500 hover:text-red-700">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'familyHistory':
                return (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-lg">Family History</h4>
                            <button
                                onClick={() => handleAdd('familyHistory')}
                                className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
                            >
                                <Plus size={18} />
                                <span>Add Family History</span>
                            </button>
                        </div>
                        {familyHistory.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">No family history recorded. Click "Add Family History" to add one.</p>
                        ) : (
                            <div className="space-y-2">
                                {familyHistory.map(fh => {
                                    const refItem = referenceFamilyHistory.find(r => r.id === fh.familyhistory_id);
                                    return (
                                        <div key={fh.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                            <div>
                                                <span className="font-medium">{refItem?.name || 'Unknown'}</span>
                                                {fh.level && <span className="text-sm text-slate-600 ml-2">({fh.level})</span>}
                                            </div>
                                            <div className="flex space-x-2">
                                                <button onClick={() => handleEdit(fh, 'familyHistory')} className="text-blue-600 hover:text-blue-800">
                                                    <Edit size={18} />
                                                </button>
                                                <button onClick={() => onDeleteFamilyHistory(fh.id)} className="text-red-500 hover:text-red-700">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Medical History: ${patient.name}`} size="xl">
            <div className="space-y-4">
                <div className="flex space-x-2 border-b">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                handleCancel();
                            }}
                            className={`flex items-center space-x-2 px-4 py-2 font-semibold transition-colors ${
                                activeTab === tab.id
                                    ? 'text-primary border-b-2 border-primary'
                                    : 'text-slate-600 hover:text-primary'
                            }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {renderTabContent()}
            </div>
        </Modal>
    );
};

const MedicalHistoryFormModal = ({
    type,
    item,
    referenceAllergies,
    referenceMedications,
    referenceVaccinations,
    referenceFamilyHistory,
    onSave,
    onCancel,
    validationErrors,
}) => {
    const [formData, setFormData] = useState({
        allergy_id: item?.allergy_id || '',
        vaccin_id: item?.vaccin_id || '',
        medication_id: item?.medication_id || '',
        familyhistory_id: item?.familyhistory_id || '',
        date: item?.date || '',
        level: item?.level || '',
        dose: item?.dose || '',
        delay: item?.delay || '',
    });

    useEffect(() => {
        if (item) {
            setFormData({
                allergy_id: item.allergy_id || '',
                vaccin_id: item.vaccin_id || '',
                medication_id: item.medication_id || '',
                familyhistory_id: item.familyhistory_id || '',
                date: item.date || '',
                level: item.level || '',
                dose: item.dose || '',
                delay: item.delay || '',
            });
        }
    }, [item]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Get selected medication description from reference data
    const getSelectedMedicationDescription = () => {
        if (type === 'medication' && formData.medication_id) {
            const selectedMed = referenceMedications.find(m => m.id === Number(formData.medication_id));
            return selectedMed?.description || '';
        }
        return '';
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData, type);
    };

    const getReferenceOptions = () => {
        switch (type) {
            case 'allergy':
                return referenceAllergies;
            case 'vaccin':
                return referenceVaccinations;
            case 'medication':
                return referenceMedications;
            case 'familyHistory':
                return referenceFamilyHistory;
            default:
                return [];
        }
    };

    const options = getReferenceOptions();
    const hasOptions = options && options.length > 0;

    return (
        <div className="bg-slate-50 p-4 rounded-lg border-2 border-primary">
            <h4 className="font-bold text-lg mb-4">
                {item ? 'Edit' : 'Add'} {type === 'allergy' ? 'Allergy' : type === 'vaccin' ? 'Vaccination' : type === 'medication' ? 'Medication' : 'Family History'}
            </h4>
            {!hasOptions && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg mb-4">
                    <p className="font-semibold">⚠️ No options available</p>
                    <p className="text-sm mt-1">No {type === 'allergy' ? 'allergies' : type === 'vaccin' ? 'vaccinations' : type === 'medication' ? 'medications' : 'family history'} found in the database. Please contact the administrator to add reference data.</p>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
                {type === 'allergy' && (
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                            Allergy <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="allergy_id"
                            value={formData.allergy_id}
                            onChange={handleChange}
                            className={`w-full p-2 border rounded-md ${validationErrors.allergy_id ? 'border-red-500' : ''}`}
                            required
                            disabled={!hasOptions}
                        >
                            <option value="">Select an allergy from database</option>
                            {options.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                            ))}
                        </select>
                        {validationErrors.allergy_id && (
                            <p className="text-red-500 text-sm mt-1">{validationErrors.allergy_id}</p>
                        )}
                        {!hasOptions && (
                            <p className="text-amber-600 text-sm mt-1">Cannot save: No allergies available in database</p>
                        )}
                    </div>
                )}

                {type === 'vaccin' && (
                    <>
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                                Vaccination <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="vaccin_id"
                                value={formData.vaccin_id}
                                onChange={handleChange}
                                className={`w-full p-2 border rounded-md ${validationErrors.vaccin_id ? 'border-red-500' : ''}`}
                                required
                                disabled={!hasOptions}
                            >
                                <option value="">Select a vaccination from database</option>
                                {options.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                            {validationErrors.vaccin_id && (
                                <p className="text-red-500 text-sm mt-1">{validationErrors.vaccin_id}</p>
                            )}
                            {!hasOptions && (
                                <p className="text-amber-600 text-sm mt-1">Cannot save: No vaccinations available in database</p>
                            )}
                        </div>
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1">Date</label>
                            <input
                                type="date"
                                name="date"
                                value={formatDateForInput(formData.date)}
                                onChange={handleChange}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                    </>
                )}

                {type === 'medication' && (
                    <>
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                                Medication <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="medication_id"
                                value={formData.medication_id}
                                onChange={handleChange}
                                className={`w-full p-2 border rounded-md ${validationErrors.medication_id ? 'border-red-500' : ''}`}
                                required
                                disabled={!hasOptions}
                            >
                                <option value="">Select a medication from database</option>
                                {options.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                            {validationErrors.medication_id && (
                                <p className="text-red-500 text-sm mt-1">{validationErrors.medication_id}</p>
                            )}
                            {!hasOptions && (
                                <p className="text-amber-600 text-sm mt-1">Cannot save: No medications available in database</p>
                            )}
                        </div>
                        {formData.medication_id && getSelectedMedicationDescription() && (
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Description <span className="text-xs text-slate-500 font-normal">(from database)</span>
                                </label>
                                <div className="w-full p-2 border rounded-md bg-slate-100 text-slate-700">
                                    {getSelectedMedicationDescription()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">This description is automatically loaded from the database and cannot be edited.</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">Dose</label>
                                <input
                                    type="text"
                                    name="dose"
                                    value={formData.dose}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Optional dose"
                                />
                            </div>
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">Delay</label>
                                <input
                                    type="text"
                                    name="delay"
                                    value={formData.delay}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Optional delay"
                                />
                            </div>
                        </div>
                    </>
                )}

                {type === 'familyHistory' && (
                    <>
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                                Family History <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="familyhistory_id"
                                value={formData.familyhistory_id}
                                onChange={handleChange}
                                className={`w-full p-2 border rounded-md ${validationErrors.familyhistory_id ? 'border-red-500' : ''}`}
                                required
                                disabled={!hasOptions}
                            >
                                <option value="">Select a family history from database</option>
                                {options.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                            {validationErrors.familyhistory_id && (
                                <p className="text-red-500 text-sm mt-1">{validationErrors.familyhistory_id}</p>
                            )}
                            {!hasOptions && (
                                <p className="text-amber-600 text-sm mt-1">Cannot save: No family history available in database</p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Degree of Relation <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="level"
                                    value={formData.level}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded-md ${validationErrors.level ? 'border-red-500' : ''}`}
                                    required
                                >
                                    <option value="">Select degree of relation</option>
                                    <option value="First Degree Relative">First Degree Relative</option>
                                    <option value="Second Degree Relative">Second Degree Relative</option>
                                </select>
                                {validationErrors.level && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.level}</p>
                                )}
                            </div>
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">Date</label>
                                <input
                                    type="date"
                                name="date"
                                value={formatDateForInput(formData.date)}
                                onChange={handleChange}
                                className="w-full p-2 border rounded-md"
                            />
                            </div>
                        </div>
                    </>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!hasOptions}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                            hasOptions
                                ? 'bg-primary text-white hover:bg-primary-dark'
                                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        {item ? 'Update' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SecretaryPage;
