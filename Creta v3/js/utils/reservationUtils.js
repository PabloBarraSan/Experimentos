// Reservation utility functions - Extract reservations from appointments data

/**
 * Extracts user name from appointment object
 * @param {Object} app - Appointment object
 * @returns {string} User name
 */
function extractUserName(app) {
    let userName = '';
    
    if (app.user && typeof app.user === 'object') {
        // Check if user object has meaningful data (not just shadow: true)
        const userKeys = Object.keys(app.user);
        const hasUserData = userKeys.some(key => 
            key !== 'shadow' && 
            (app.user[key] != null && app.user[key] !== '')
        );
        
        if (hasUserData) {
            // Safely extract firstName and lastName, handling null/undefined/empty strings
            const firstName = (app.user.firstName != null ? String(app.user.firstName) : '').trim();
            const lastName = (app.user.lastName != null ? String(app.user.lastName) : '').trim();
            
            // Combine names only if at least one is not empty
            if (firstName || lastName) {
                userName = `${firstName} ${lastName}`.trim();
            }
        }
    }
    
    // Fallback if still empty - try username
    if (!userName && app.user?.username) {
        userName = String(app.user.username).trim();
    }
    
    // Fallback if still empty - try email
    if (!userName && app.user?.email) {
        userName = String(app.user.email).split('@')[0].trim();
    }
    
    // Final fallback - use userId if available
    if (!userName && app.userId) {
        userName = `Usuario ID: ${app.userId}`;
    }
    
    // Last resort
    if (!userName) {
        userName = 'Sin nombre';
    }
    
    return userName;
}

/**
 * Extracts reservations from appointments data
 * @param {Object} appointmentsData - Appointments data object
 * @returns {Array} Array of reservation objects
 */
export function extractReservations(appointmentsData) {
    if (!appointmentsData || !appointmentsData.slots) {
        return [];
    }
    
    const reservations = [];
    
    appointmentsData.slots.forEach(slot => {
        // Parse slot date - use slot.start (ISO string) or slot.date as fallback
        let slotDate = null;
        try {
            // Try slot.start first (main date field)
            const dateSource = slot.start || slot.date;
            if (dateSource) {
                if (typeof dateSource === 'number') {
                    slotDate = new Date(dateSource);
                } else if (typeof dateSource === 'string') {
                    // Handle ISO string format like "2025-10-29T09:48:09.827Z" or "2025-11-19T09:30:00.000Z"
                    slotDate = new Date(dateSource);
                } else {
                    slotDate = new Date(dateSource);
                }
                // Validate date
                if (isNaN(slotDate.getTime())) {
                    slotDate = null;
                }
            }
        } catch (e) {
            slotDate = null;
        }
        
        // Confirmed appointments
        if (slot.appointments && slot.appointments.length > 0) {
            slot.appointments.forEach(app => {
                const userName = extractUserName(app);
                
                reservations.push({
                    id: app._id,
                    userName: userName,
                    email: app.user?.email,
                    telephone: app.user?.telephone,
                    date: slotDate,
                    time: slot.title || '',
                    seats: app.seats || 1,
                    turn: app.turn,
                    maskedTurn: app.maskedTurn,
                    status: app.confirmed !== false ? 'confirmed' : 'pending', // Default to confirmed if not explicitly false
                    isPaid: app.isPaid,
                    timestamp: app.timestamp,
                    slot: slot,
                    appointment: app
                });
            });
        }
        
        // Pending appointments
        if (slot.pendingAppointments && slot.pendingAppointments.length > 0) {
            slot.pendingAppointments.forEach(app => {
                const userName = extractUserName(app);
                
                reservations.push({
                    id: app._id,
                    userName: userName,
                    email: app.user?.email,
                    telephone: app.user?.telephone,
                    date: slotDate,
                    time: slot.title || '',
                    seats: app.seats || 1,
                    turn: app.turn,
                    maskedTurn: app.maskedTurn,
                    status: 'pending',
                    isPaid: app.isPaid,
                    timestamp: app.timestamp,
                    slot: slot,
                    appointment: app
                });
            });
        }
        
        // Canceled appointments
        if (slot.canceledAppointments && slot.canceledAppointments.length > 0) {
            slot.canceledAppointments.forEach(app => {
                const userName = extractUserName(app);
                
                reservations.push({
                    id: app._id,
                    userName: userName,
                    email: app.user?.email,
                    telephone: app.user?.telephone,
                    date: slotDate,
                    time: slot.title || '',
                    seats: app.seats || 1,
                    turn: app.turn,
                    maskedTurn: app.maskedTurn,
                    status: 'canceled',
                    isPaid: app.isPaid,
                    timestamp: app.timestamp,
                    slot: slot,
                    appointment: app
                });
            });
        }
    });
    
    // Sort by slot date (closest first, then by time if same date)
    reservations.sort((a, b) => {
        // Use slot date (start date) as primary sort
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        
        // If dates are equal, sort by timestamp as secondary
        if (dateA.getTime() === dateB.getTime()) {
            const timestampA = a.timestamp ? new Date(a.timestamp) : new Date(0);
            const timestampB = b.timestamp ? new Date(b.timestamp) : new Date(0);
            return timestampA - timestampB;
        }
        
        // Sort by date: closest (earliest) first
        return dateA - dateB;
    });
    
    return reservations;
}

