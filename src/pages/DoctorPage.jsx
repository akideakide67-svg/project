import React, { useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import { ReportType } from '../types';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ReportPrintView from '../components/ReportPrintView';
import { FileText, Plus, Pill, TestTube2, Glasses, Stethoscope, History, ChevronDown, Search, Edit, Printer, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, formatDateTime, formatDateForInput, formatAppointmentDateTime } from '../utils/dateFormatter';

const DoctorPage = () => {
    const { appointments, getPatientById, patients } = useClinic();
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const sortedAppointments = [...(appointments || [])].sort((a, b) => {
        const dateTimeA = a.date && a.time ? new Date(`${a.date}T${a.time}`) : (a.time ? new Date(a.time) : new Date(a.dateTime || 0));
        const dateTimeB = b.date && b.time ? new Date(`${b.date}T${b.time}`) : (b.time ? new Date(b.time) : new Date(b.dateTime || 0));
        return dateTimeB.getTime() - dateTimeA.getTime();
    });

    const filteredAppointments = sortedAppointments.filter(app => {
        const patient = getPatientById(app.patientId || app.patient_id);
        const patientName = patient?.name || app.patientName || '';
        const patientId = String(app.patientId || app.patient_id || '');
        return patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
               patientId.includes(searchQuery);
    });

    const handleSelectAppointment = (appointment) => {
        setSelectedAppointment(appointment);
    };

    return (
        <Layout title="Doctor's Dashboard">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-700">All Appointments</h3>
                <div className="relative">
                    <input 
                        type="text"
                        placeholder="Search by patient name or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 border rounded-lg w-64"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                </div>
            </div>
            {filteredAppointments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAppointments.map(app => {
                        // Handle both camelCase and snake_case patient ID
                        const patientId = app.patientId || app.patient_id;
                        const patient = getPatientById(patientId);
                        return (
                            <div key={app.id} onClick={() => handleSelectAppointment(app)}
                                className="bg-white p-6 rounded-xl shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col justify-between">
                                 <div>
                                    <p className="font-bold text-lg text-primary">{patient?.name || app.patientName || 'Unknown'}</p>
                                    <p className="text-slate-600 text-base">
                                        {formatAppointmentDateTime(app) || formatDateTime(app.date, app.time) || formatDate(app.dateTime) || 'Date not available'}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-2">Patient ID: {patientId}</p>
                                </div>
                                {app.note && (
                                    <div className="mt-4 pt-2 border-t border-slate-200">
                                        <p className="text-sm text-amber-800 bg-amber-100 p-2 rounded-md">
                                            <strong className="font-semibold">Note:</strong> {app.note}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-slate-500">No matching appointments found.</p>
            )}

            {selectedAppointment && (
                <PatientCaseModal
                    appointment={selectedAppointment}
                    patient={getPatientById(selectedAppointment.patientId || selectedAppointment.patient_id)}
                    onClose={() => setSelectedAppointment(null)}
                />
            )}
        </Layout>
    );
};

const PatientCaseModal = ({ appointment, patient, onClose }) => {
    const { 
        updateAppointment, appointments, timeSlots, rescheduleAppointment,
        causes, documents, appointmentMedications,
        addCause, deleteCause, addDocument,
        addPrescription, deletePrescription,
        allergies, vaccins, medications, familyHistory,
        referenceCauses, referenceMedications,
        getPatientDetails, getAppointmentDetails, getPatientMedicalHistory
    } = useClinic();
    
    const [currentAppointment, setCurrentAppointment] = useState({
        ...appointment,
        note: appointment.note || appointment.observation || '',
    });
    const [isPrescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);
    const [isRescheduleModalOpen, setRescheduleModalOpen] = useState(false);
    const [isCauseModalOpen, setCauseModalOpen] = useState(false);
    const [reportToGenerate, setReportToGenerate] = useState(null);
    
    // State for complete patient details (fetched from API)
    const [patientDetails, setPatientDetails] = useState(null);
    const [loadingPatientDetails, setLoadingPatientDetails] = useState(false);
    
    // State for appointment-specific data (causes, prescriptions, reports)
    const [appointmentData, setAppointmentData] = useState(null);
    const [loadingAppointmentData, setLoadingAppointmentData] = useState(false);
    
    // State for medical history
    const [medicalHistory, setMedicalHistory] = useState([]);

    // Get related entities for this appointment - use appointmentData if loaded, otherwise fall back to context
    const appointmentMedicates = appointmentData?.prescriptions || (appointmentMedications || []).filter(m => 
        String(m.appointmentId || m.appointment_id) === String(appointment.id)
    );
    const appointmentCauses = (appointmentData?.causes || (causes || []).filter(c => 
        String(c.appointmentId || c.appointment_id) === String(appointment.id)
    )).map(c => {
        // Ensure composite id exists for each cause
        const causeId = c.id || (c.appointment_id && c.cause_id ? `${c.appointment_id}-${c.cause_id}` : null);
        // Ensure description is available for display (prioritize cause_description from backend)
        const causeDesc = c.cause_description || c.description || c.cause_name || '';
        return { 
            ...c, 
            id: causeId,
            cause_description: causeDesc,
            description: causeDesc,
            cause_name: causeDesc
        };
    });
    const appointmentDocuments = appointmentData?.reports || (documents || []).filter(d => 
        String(d.appointmentId || d.appointment_id) === String(appointment.id)
    );
    
    // Use patientDetails if available, otherwise fall back to context data
    // This ensures we always have the most up-to-date patient information
    const patientAllergies = patientDetails?.allergies || (allergies || []).filter(a => {
        const patientId = patient?.id || appointment.patientId || appointment.patient_id;
        return String(a.patientId) === String(patientId);
    });
    const patientVaccins = patientDetails?.vaccines || (vaccins || []).filter(v => {
        const patientId = patient?.id || appointment.patientId || appointment.patient_id;
        return String(v.patientId) === String(patientId);
    });
    const patientMedications = patientDetails?.medications || (medications || []).filter(m => {
        const patientId = patient?.id || appointment.patientId || appointment.patient_id;
        return String(m.patientId) === String(patientId);
    });
    const patientFamilyHistory = patientDetails?.familyHistory || (familyHistory || []).filter(fh => {
        const patientId = patient?.id || appointment.patientId || appointment.patient_id;
        return String(fh.patientId) === String(patientId);
    });
    
    // Use patientDetails if available, otherwise use patient from props
    const displayPatient = patientDetails || patient;
    
    // Fetch complete patient details when modal opens
    React.useEffect(() => {
        const patientId = patient?.id || appointment.patientId || appointment.patient_id;
        if (patientId && getPatientDetails) {
            setLoadingPatientDetails(true);
            getPatientDetails(patientId)
                .then(details => {
                    setPatientDetails(details);
                    setLoadingPatientDetails(false);
                })
                .catch(error => {
                    console.error('Error fetching patient details:', error);
                    setLoadingPatientDetails(false);
                    // Fall back to context data if API call fails
                });
        }
    }, [appointment, patient, getPatientDetails]);
    
    // Fetch appointment details (causes, prescriptions, reports) when modal opens
    React.useEffect(() => {
        const appointmentId = appointment.id;
        if (appointmentId && getAppointmentDetails) {
            setLoadingAppointmentData(true);
            getAppointmentDetails(appointmentId)
                .then(details => {
                    setAppointmentData(details);
                    // Update current appointment note if not already set
                    if (details.note && !currentAppointment.note) {
                        setCurrentAppointment(prev => ({ ...prev, note: details.note }));
                    }
                    setLoadingAppointmentData(false);
                })
                .catch(error => {
                    console.error('Error fetching appointment details:', error);
                    setLoadingAppointmentData(false);
                    // Fall back to context data if API call fails
                });
        }
    }, [appointment.id, getAppointmentDetails]);

    const recognitionRef = React.useRef(null);
    const [activeDictationTarget, setActiveDictationTarget] = React.useState(null);
    const hasRecognitionSupport = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const userManuallyStoppedRef = React.useRef(false);

    const stopDictation = React.useCallback(() => {
        if (recognitionRef.current) {
            userManuallyStoppedRef.current = true;
            recognitionRef.current.stop();
        }
    }, []);

    const startDictation = React.useCallback((target) => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let newTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    newTranscript += event.results[i][0].transcript;
                }
            }

            if (newTranscript) {
                setCurrentAppointment(prev => {
                    const existingText = prev[target] || '';
                    const newText = (existingText.trim() ? existingText.trim() + ' ' : '') + newTranscript.trim();
                    return { ...prev, [target]: newText };
                });
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'network') {
                alert('Speech recognition failed due to a network error. Please check your internet connection and try again.');
            } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                alert('Microphone access was denied. Please allow microphone access in your browser settings.');
            } else {
                 alert(`An error occurred during speech recognition: ${event.error}`);
            }
        };

        recognition.onend = () => {
            if (recognitionRef.current === recognition) {
                setActiveDictationTarget(null);
                recognitionRef.current = null;
            }
        };

        recognition.start();
        recognitionRef.current = recognition;
        userManuallyStoppedRef.current = false;
        setActiveDictationTarget(target);
    }, []);

    const toggleDictation = (target) => {
        if (!hasRecognitionSupport) {
            alert('Speech recognition is not supported in this browser.');
            return;
        }
        if (activeDictationTarget === target) {
            stopDictation();
        } else {
            startDictation(target);
        }
    };

    React.useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                userManuallyStoppedRef.current = true;
                recognitionRef.current.stop();
            }
        };
    }, []);

    const handleSave = async () => {
        stopDictation();
        try {
            // Save appointment notes
            await updateAppointment(currentAppointment);
            // All other data (causes, prescriptions, reports) are saved immediately when added
            // so we don't need to save them again here
            onClose();
        } catch (error) {
            console.error('Error saving appointment:', error);
            alert('Failed to save appointment. Please try again.');
        }
    };
    
    const handleAddPrescription = async (prescription) => {
        try {
            const newPrescription = {
                appointmentId: appointment.id,
                appointment_id: appointment.id,
                medication_id: prescription.medication_id,
                dose: prescription.dose || '',
                delay: prescription.delay || '',
            };
            await addPrescription(newPrescription);
            setPrescriptionModalOpen(false);
        } catch (error) {
            console.error('Error adding prescription:', error);
            alert('Failed to add prescription. Please try again.');
        }
    };
    
    const handleDeletePrescription = async (id) => {
        if (window.confirm('Are you sure you want to delete this prescription?')) {
            try {
                await deletePrescription(id);
            } catch (error) {
                console.error('Error deleting prescription:', error);
                alert('Failed to delete prescription. Please try again.');
            }
        }
    };

    const handleAddCause = async (causeData) => {
        try {
            const newCause = {
                appointmentId: appointment.id,
                appointment_id: appointment.id,
                cause_id: causeData.cause_id || causeData.causeId || null,
                description: causeData.description || null,
            };
            await addCause(newCause);
            setCauseModalOpen(false);
        } catch (error) {
            console.error('Error adding cause:', error);
            alert('Failed to add cause. Please try again.');
        }
    };
    
    const handleDeleteCause = async (id) => {
        if (window.confirm('Are you sure you want to delete this cause?')) {
            try {
                await deleteCause(id);
            } catch (error) {
                console.error('Error deleting cause:', error);
                alert('Failed to delete cause. Please try again.');
            }
        }
    };

    const handleGenerateReport = (reportData) => {
        if (!reportToGenerate || !displayPatient) return;
        const newDocument = {
            appointmentId: appointment.id,
            type: reportToGenerate,
            content: JSON.stringify({
                ...reportData,
                patientInfo: `Name: ${displayPatient.name}\nDOB: ${displayPatient.dob}\nGender: ${displayPatient.gender}`,
            }),
            date: new Date().toISOString(),
        };
        addDocument(newDocument);
        setReportModalOpen(false);
    }
    
    if (!displayPatient) {
        if (loadingPatientDetails) {
            return (
                <Modal isOpen={true} onClose={onClose} title="Loading Patient Details..." size="xl">
                    <div className="flex items-center justify-center py-8">
                        <p className="text-slate-500">Loading patient information...</p>
                    </div>
                </Modal>
            );
        }
        return (
            <Modal isOpen={true} onClose={onClose} title="Patient Not Found" size="xl">
                <div className="flex items-center justify-center py-8">
                    <p className="text-red-500">Patient information could not be loaded.</p>
                </div>
            </Modal>
        );
    }

    // Load medical history when history modal opens
    React.useEffect(() => {
        if (isHistoryModalOpen && displayPatient && getPatientMedicalHistory) {
            const patientId = displayPatient.id;
            getPatientMedicalHistory(patientId)
                .then(history => {
                    setMedicalHistory(history);
                })
                .catch(error => {
                    console.error('Error fetching medical history:', error);
                    // Fall back to filtering appointments from context
                    const patientId = displayPatient.id || appointment.patientId || appointment.patient_id;
                    const history = (appointments || [])
                        .filter(a => String(a.patientId || a.patient_id) === String(patientId))
                        .sort((a, b) => {
                            const dateTimeA = a.date && a.time ? new Date(`${a.date}T${a.time}`) : new Date(a.dateTime || 0);
                            const dateTimeB = b.date && b.time ? new Date(`${b.date}T${b.time}`) : new Date(b.dateTime || 0);
                            return dateTimeA.getTime() - dateTimeB.getTime(); // Old → New
                        });
                    setMedicalHistory(history);
                });
        }
    }, [isHistoryModalOpen, displayPatient, getPatientMedicalHistory]);
    
    const patientHistory = medicalHistory.length > 0 ? medicalHistory : (appointments || [])
        .filter(a => {
            const patientId = displayPatient.id || appointment.patientId || appointment.patient_id;
            return String(a.patientId || a.patient_id) === String(patientId);
        })
        .sort((a, b) => {
            const dateTimeA = a.date && a.time ? new Date(`${a.date}T${a.time}`) : new Date(a.dateTime || 0);
            const dateTimeB = b.date && b.time ? new Date(`${b.date}T${b.time}`) : new Date(b.dateTime || 0);
            return dateTimeA.getTime() - dateTimeB.getTime(); // Old → New
        });

    return (
        <Modal isOpen={true} onClose={onClose} title={`Case: ${displayPatient.name || 'Unknown Patient'}`} size="xl">
            <div className="space-y-6">
                {/* Patient Profile Snapshot */}
                <div className="bg-secondary p-4 rounded-lg">
                     <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-lg text-primary">Patient Profile</h4>
                        <button onClick={() => setHistoryModalOpen(true)} className="flex items-center space-x-2 text-sm bg-white border border-slate-300 text-slate-700 px-3 py-1 rounded-md hover:bg-slate-50 transition-colors">
                            <History size={16} />
                            <span>View Full Medical History</span>
                        </button>
                     </div>
                     <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <p><strong className="font-semibold">Allergies:</strong> {patientAllergies.length > 0 ? patientAllergies.map(a => a.name).join(', ') : 'N/A'}</p>
                        <p><strong className="font-semibold">Current Meds:</strong> {patientMedications.length > 0 ? patientMedications.map(m => m.name).join(', ') : 'N/A'}</p>
                        <p><strong className="font-semibold">Vaccines:</strong> {patientVaccins.length > 0 ? patientVaccins.map(v => v.name).join(', ') : 'N/A'}</p>
                        <p><strong className="font-semibold">Family History:</strong> {patientFamilyHistory.length > 0 ? patientFamilyHistory.map(fh => fh.name).join(', ') : 'N/A'}</p>
                     </div>
                </div>

                {/* Observation & Schedule Note */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="note" className="font-semibold text-slate-700">Note (Observation & Diagnosis)</label>
                            {hasRecognitionSupport && (
                                <button
                                    type="button"
                                    onClick={() => toggleDictation('note')}
                                    aria-label="Dictate note"
                                    className={`p-2 rounded-full transition-colors ${activeDictationTarget === 'note' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                                >
                                    {activeDictationTarget === 'note' ? (
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ duration: 1, repeat: Infinity }}
                                        >
                                            <Mic size={16} />
                                        </motion.div>
                                    ) : (
                                        <Mic size={16} />
                                    )}
                                </button>
                            )}
                        </div>
                        <textarea 
                            id="note"
                            value={currentAppointment.note || ''}
                            onChange={(e) => setCurrentAppointment(p => ({...p, note: e.target.value}))}
                            className="w-full p-2 border rounded-md" rows={6}
                            placeholder="Add your notes, observations, and diagnosis here... or use the mic to dictate."
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-lg text-primary">Causes</h4>
                            <button onClick={() => setCauseModalOpen(true)} className="text-sm flex items-center space-x-1 text-primary hover:underline"><Plus size={16}/><span>Add</span></button>
                        </div>
                        <div className="space-y-2 p-2 bg-slate-50 rounded-md max-h-40 overflow-y-auto">
                            {appointmentCauses.length > 0 ? (
                                appointmentCauses.map(c => {
                                    const causeId = c.id || `${c.appointment_id || c.appointmentId}-${c.cause_id || c.causeId}`;
                                    return (
                                        <div key={causeId} className="text-sm p-2 bg-white border rounded-md flex justify-between items-center">
                                            <span>{c.cause_description || c.description || c.cause_name || 'Unknown cause'}</span>
                                            <button 
                                                onClick={() => handleDeleteCause(causeId)}
                                                className="text-red-500 hover:text-red-700 text-xs ml-2"
                                                title="Delete cause"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-sm text-slate-500">No causes recorded.</p>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Prescriptions and Reports */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                           <h4 className="font-bold text-lg text-primary">Prescriptions</h4>
                           <button onClick={() => setPrescriptionModalOpen(true)} className="text-sm flex items-center space-x-1 text-primary hover:underline"><Plus size={16}/><span>Add</span></button>
                        </div>
                         <div className="space-y-2 p-2 bg-slate-50 rounded-md max-h-40 overflow-y-auto">
                            {appointmentMedicates.length > 0 ? (
                                appointmentMedicates.map(m => (
                                    <div key={m.id} className="text-sm p-2 bg-white border rounded-md">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="font-semibold text-slate-800">{m.name}</div>
                                                {m.dose && <div className="text-slate-600 mt-1">Dose: {m.dose}</div>}
                                                {m.delay && (
                                                    <div className="text-slate-600 mt-1">Delay: {m.delay}</div>
                                                )}
                                                {m.description && (
                                                    <p className="text-xs text-slate-500 mt-1 italic">{m.description}</p>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => handleDeletePrescription(m.id)}
                                                className="text-red-500 hover:text-red-700 text-xs ml-2"
                                                title="Delete prescription"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500">No prescriptions.</p>
                            )}
                        </div>
                    </div>
                     <div>
                        <h4 className="font-bold text-lg text-primary mb-2">Reports</h4>
                         <div className="space-y-2">
                            <button onClick={() => { setReportToGenerate(ReportType.COMPTE_RENDU); setReportModalOpen(true);}} className="w-full text-left p-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm">Generate Compte Rendu</button>
                            <button onClick={() => { setReportToGenerate(ReportType.MEDICAL_CERTIFICATE); setReportModalOpen(true);}} className="w-full text-left p-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm">Generate Medical Certificate</button>
                            <button onClick={() => { setReportToGenerate(ReportType.REFERRAL_LETTER); setReportModalOpen(true);}} className="w-full text-left p-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm">Generate Referral Letter</button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center space-x-4">
                    <button onClick={() => setRescheduleModalOpen(true)} className="w-full flex items-center justify-center space-x-2 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors font-semibold">
                        <Edit size={16}/>
                        <span>Reschedule</span>
                    </button>
                    <button onClick={handleSave} className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition-colors font-semibold">Save and Close</button>
                </div>
            </div>
            
            {isPrescriptionModalOpen && (
                <PrescriptionModal 
                    isOpen={isPrescriptionModalOpen} 
                    onClose={() => setPrescriptionModalOpen(false)} 
                    onSubmit={handleAddPrescription}
                    referenceMedications={referenceMedications || []}
                />
            )}
            <CauseModal 
                isOpen={isCauseModalOpen} 
                onClose={() => setCauseModalOpen(false)} 
                onSubmit={handleAddCause}
                referenceCauses={referenceCauses || []}
            />
            {reportToGenerate && <ReportFormModal isOpen={isReportModalOpen} onClose={() => setReportModalOpen(false)} reportType={reportToGenerate} onSubmit={handleGenerateReport}/>}
            {isHistoryModalOpen && <PatientHistoryModal isOpen={isHistoryModalOpen} onClose={() => setHistoryModalOpen(false)} patient={displayPatient} appointmentsHistory={patientHistory} />}
            {isRescheduleModalOpen && (
                <RescheduleModal 
                    isOpen={isRescheduleModalOpen}
                    onClose={() => setRescheduleModalOpen(false)}
                    appointment={currentAppointment}
                    timeSlots={(timeSlots || []).filter(ts => !ts.isBooked)}
                    onReschedule={(newTimeSlotId) => {
                        rescheduleAppointment(currentAppointment.id, newTimeSlotId);
                        onClose();
                    }}
                />
            )}
        </Modal>
    );
};


const RescheduleModal = ({ isOpen, onClose, appointment, timeSlots, onReschedule }) => {
    const [selectedSlotId, setSelectedSlotId] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (selectedSlotId) {
            onReschedule(selectedSlotId);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Reschedule for ${appointment.patientName}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <p className="font-semibold">Current Appointment:</p>
                    <p className="p-2 bg-slate-100 rounded-md">
                        {formatDateTime(appointment.date, appointment.time) || formatDate(appointment.dateTime)}
                    </p>
                </div>
                <select value={selectedSlotId} onChange={e => setSelectedSlotId(e.target.value)} className="w-full p-2 border rounded-md" required>
                    <option value="">Select New Available Slot</option>
                    {timeSlots.map(ts => (
                        <option key={ts.id} value={ts.id}>{formatDateTime(ts.date, ts.time) || formatDate(ts.dateTime)}</option>
                    ))}
                </select>
                <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition-colors">Confirm Reschedule</button>
            </form>
        </Modal>
    );
};


const PrescriptionModal = ({isOpen, onClose, onSubmit, referenceMedications}) => {
    const [formData, setFormData] = useState({
        medication_id: '',
        dose: '',
        delay: '',
    });

    React.useEffect(() => {
        if (isOpen) {
            setFormData({
                medication_id: '',
                dose: '',
                delay: '',
            });
        }
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Get selected medication description from reference data
    const getSelectedMedicationDescription = () => {
        if (formData.medication_id) {
            const selectedMed = referenceMedications.find(m => m.id === Number(formData.medication_id));
            return selectedMed?.description || '';
        }
        return '';
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.medication_id) {
            alert('Please select a medication from the list.');
            return;
        }
        onSubmit(formData);
        setFormData({
            medication_id: '',
            dose: '',
            delay: '',
        });
        onClose();
    };

    const hasOptions = referenceMedications && referenceMedications.length > 0;

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="bg-slate-50 p-4 rounded-lg border-2 border-primary">
                <h4 className="font-bold text-lg mb-4">Add Prescription</h4>
                {!hasOptions && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg mb-4">
                        <p className="font-semibold">⚠️ No options available</p>
                        <p className="text-sm mt-1">No medications found in the database. Please contact the administrator to add reference data.</p>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                            Medication <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="medication_id"
                            value={formData.medication_id}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md"
                            required
                            disabled={!hasOptions}
                        >
                            <option value="">Select a medication from database</option>
                            {hasOptions && referenceMedications.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                            ))}
                        </select>
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
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!hasOptions}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    )
};

const CauseModal = ({isOpen, onClose, onSubmit, referenceCauses}) => {
    const [selectedCauseId, setSelectedCauseId] = useState('');
    const [description, setDescription] = useState('');
    
    React.useEffect(() => {
        if (isOpen) {
            setSelectedCauseId('');
            setDescription('');
        }
    }, [isOpen]);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedCauseId && !description.trim()) {
            alert('Please select a cause from the list or enter a description.');
            return;
        }
        onSubmit({
            cause_id: selectedCauseId || null,
            description: description.trim() || null,
        });
        setSelectedCauseId('');
        setDescription('');
        onClose();
    }
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Cause">
            <form onSubmit={handleSubmit} className="space-y-4">
                {referenceCauses && referenceCauses.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Select Cause (from reference table)</label>
                        <select 
                            value={selectedCauseId} 
                            onChange={e => setSelectedCauseId(e.target.value)}
                            className="w-full p-2 border rounded-md"
                        >
                            <option value="">-- Select a cause --</option>
                            {referenceCauses.map(cause => (
                                <option key={cause.id} value={cause.id}>
                                    {cause.name || cause.description || `Cause #${cause.id}`}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        {referenceCauses && referenceCauses.length > 0 ? 'Or enter description (optional)' : 'Description'}
                    </label>
                    <textarea 
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        placeholder="Enter cause description if not selecting from list..." 
                        className="w-full p-2 border rounded-md" 
                        rows={4}
                        required={!selectedCauseId}
                    />
                </div>
                <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg">Add</button>
            </form>
        </Modal>
    )
};

const ReportFormModal = ({isOpen, onClose, reportType, onSubmit}) => {
    const [formData, setFormData] = useState({});
    const handleChange = (e) => setFormData(prev => ({...prev, [e.target.name]: e.target.value}));
    const handleSubmit = (e) => { e.preventDefault(); onSubmit(formData); };
    
    const renderFields = () => {
        switch(reportType) {
            case ReportType.COMPTE_RENDU: return <>
                <textarea name="clinicalFindings" onChange={handleChange} placeholder="Clinical Findings" className="w-full p-2 border rounded-md" rows={3}></textarea>
                <textarea name="diagnosis" onChange={handleChange} placeholder="Diagnosis" className="w-full p-2 border rounded-md" rows={3}></textarea>
                <textarea name="treatmentAndRecommendations" onChange={handleChange} placeholder="Treatment and Recommendations" className="w-full p-2 border rounded-md" rows={3}></textarea>
            </>;
            case ReportType.MEDICAL_CERTIFICATE: return <>
                <textarea name="medicalExaminationFindings" onChange={handleChange} placeholder="Medical Examination Findings" className="w-full p-2 border rounded-md" rows={3}></textarea>
                <textarea name="recommendations" onChange={handleChange} placeholder="Recommendations" className="w-full p-2 border rounded-md" rows={3}></textarea>
                <textarea name="durationOfIncapacity" onChange={handleChange} placeholder="Duration of Incapacity" className="w-full p-2 border rounded-md" rows={3}></textarea>
            </>;
            case ReportType.REFERRAL_LETTER: return <>
                <textarea name="referringDoctorInfo" onChange={handleChange} placeholder="Referring Doctor Information" className="w-full p-2 border rounded-md" rows={2}></textarea>
                <textarea name="reasonForReferral" onChange={handleChange} placeholder="Reason for Referral" className="w-full p-2 border rounded-md" rows={2}></textarea>
                <textarea name="clinicalFindingsAndResults" onChange={handleChange} placeholder="Clinical Findings and Results" className="w-full p-2 border rounded-md" rows={2}></textarea>
                <textarea name="treatmentGiven" onChange={handleChange} placeholder="Treatment Given" className="w-full p-2 border rounded-md" rows={2}></textarea>
                <textarea name="patientCurrentStatus" onChange={handleChange} placeholder="Patient's Current Status" className="w-full p-2 border rounded-md" rows={2}></textarea>
                <textarea name="treatmentGoalsAndPlan" onChange={handleChange} placeholder="Treatment Goals and Plan" className="w-full p-2 border rounded-md" rows={2}></textarea>
            </>;
            default: return null;
        }
    }
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Generate ${reportType}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {renderFields()}
                <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg">Generate</button>
            </form>
        </Modal>
    );
};

const AppointmentHistoryItem = ({ appointment, onViewReport }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Use safe formatter that avoids timezone conversion
    const dateTimeDisplay = formatAppointmentDateTime(appointment) || formatDateTime(appointment.date, appointment.time) || formatDate(appointment.dateTime) || 'Date not available';
    
    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100">
                <span className="font-semibold text-primary text-base">
                    {dateTimeDisplay}
                </span>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
                    <ChevronDown size={20} className="text-slate-500" />
                </motion.div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <AppointmentHistoryDetails appointment={appointment} onViewReport={onViewReport} />
                )}
            </AnimatePresence>
        </div>
    );
};

const AppointmentHistoryDetails = ({ appointment, onViewReport }) => {
    // Use appointment data directly if it has causes, prescriptions, reports
    // Otherwise fall back to context data
    const appointmentCauses = appointment.causes || [];
    const appointmentPrescriptions = appointment.prescriptions || [];
    const appointmentDocuments = appointment.reports || [];
    
    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
        >
            <div className="p-4 space-y-4 bg-white border-t">
                {appointment.note && (
                    <div>
                        <h5 className="font-semibold text-slate-600 mb-1">Doctor Notes</h5>
                        <p className="text-sm text-slate-700 bg-slate-50 p-2 border rounded-md whitespace-pre-wrap">{appointment.note}</p>
                    </div>
                )}
                {appointmentCauses.length > 0 && (
                    <div>
                        <h5 className="font-semibold text-slate-600 mb-1">Causes</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                            {appointmentCauses.map(c => {
                                const causeId = c.id || `${c.appointment_id || c.appointmentId}-${c.cause_id || c.causeId}`;
                                return (
                                    <li key={causeId}>
                                        {c.cause_description || c.description || c.cause_name || 'Unknown cause'}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
                <div>
                    <h5 className="font-semibold text-slate-600 mb-1">Prescriptions</h5>
                    {appointmentPrescriptions.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                            {appointmentPrescriptions.map(p => (
                                <li key={p.id}>
                                    <strong>{p.name}:</strong>
                                    {p.dose && ` Dose: ${p.dose}`}
                                    {p.delay && ` Delay: ${p.delay}`}
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-slate-500">No prescriptions.</p>}
                </div>
                <div>
                    <h5 className="font-semibold text-slate-600 mb-1">Reports</h5>
                    {appointmentDocuments.length > 0 ? (
                        <div className="space-y-2">
                            {appointmentDocuments.map(d => {
                                try {
                                    const docData = JSON.parse(d.content);
                                    return (
                                        <button key={d.id} onClick={() => onViewReport({...docData, id: d.id, type: d.type, date: d.date})} className="w-full text-left p-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm flex items-center space-x-2">
                                            <FileText size={16}/>
                                            <span>{d.type} - {formatDate(d.date)}</span>
                                        </button>
                                    );
                                } catch {
                                    return (
                                        <button key={d.id} onClick={() => onViewReport({id: d.id, type: d.type, date: d.date, content: d.content})} className="w-full text-left p-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm flex items-center space-x-2">
                                            <FileText size={16}/>
                                            <span>{d.type} - {formatDate(d.date)}</span>
                                        </button>
                                    );
                                }
                            })}
                        </div>
                    ) : <p className="text-sm text-slate-500">No reports.</p>}
                </div>
            </div>
        </motion.div>
    );
};

const PatientHistoryModal = ({isOpen, onClose, patient, appointmentsHistory}) => {
    const [reportToView, setReportToView] = useState(null);

    const handlePrint = () => {
        window.print();
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Medical History: ${patient?.name || 'Unknown Patient'}`} size="xl">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {appointmentsHistory.map(app => <AppointmentHistoryItem key={app.id} appointment={app} onViewReport={setReportToView} />)}
            </div>

            {reportToView && (
                <Modal isOpen={!!reportToView} onClose={() => setReportToView(null)} title="View Report" size="lg">
                    <ReportPrintView report={reportToView} patientName={patient?.name || 'Unknown Patient'} />
                     <div className="mt-4 text-right no-print">
                        <button onClick={handlePrint} className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors">
                           <Printer size={20} />
                           <span>Print Report</span>
                        </button>
                    </div>
                </Modal>
            )}
        </Modal>
    );
};

export default DoctorPage;

