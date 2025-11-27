// API Module - Handles all API calls for the Creta application

const API_BASE_URL = 'https://public.digitalvalue.es:8867/v2/pinto';

/**
 * Fetch all resources from the API
 * @returns {Promise<Array>} Array of resources
 */
export async function fetchResources() {
    try {
        console.log("Fetching resources from API...");
        const response = await fetch(`${API_BASE_URL}/resources`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error fetching resources');
        const data = await response.json();
        console.log("Resources loaded from API");
        return data;
    } catch (error) {
        console.error("Failed to fetch resources:", error);
        return [];
    }
}

/**
 * Fetch appointments for a specific resource and group
 * @param {string} resourceId - Resource ID
 * @param {string} groupId - Group ID
 * @param {number} start - Start timestamp (milliseconds)
 * @param {number} end - End timestamp (milliseconds)
 * @returns {Promise<Object>} Appointments data
 */
export async function fetchAppointments(resourceId, groupId, start, end) {
    try {
        const url = `${API_BASE_URL}/all?start=${start}&end=${end}&groupIds=${groupId}&resourceIds=${resourceId}`;
        console.log("Fetching appointments from:", url);

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error fetching appointments');
        const data = await response.json();
        console.log("Appointments loaded from API");
        return data;
    } catch (error) {
        console.error("Failed to fetch appointments:", error);
        return null;
    }
}

/**
 * Calculate statistics from appointments data
 * @param {Object} appointmentsData - Data from /all API endpoint
 * @returns {Object} Statistics object
 */
export function calculateStats(appointmentsData) {
    if (!appointmentsData || !appointmentsData.slots) {
        return {
            totalSlots: 0,
            confirmedAppointments: 0,
            availableSeats: 0,
            canceledAppointments: 0,
            pendingAppointments: 0
        };
    }

    const stats = {
        totalSlots: 0,
        confirmedAppointments: 0,
        availableSeats: 0,
        canceledAppointments: 0,
        pendingAppointments: 0
    };

    appointmentsData.slots.forEach(slot => {
        stats.totalSlots++;
        stats.availableSeats += slot.seats.remaining || 0;

        // Count confirmed appointments
        if (slot.appointments) {
            slot.appointments.forEach(app => {
                if (app.confirmed && app.status === 'requested') {
                    stats.confirmedAppointments++;
                } else if (!app.confirmed) {
                    stats.pendingAppointments++;
                }
            });
        }

        // Count canceled appointments
        if (slot.canceledAppointments) {
            stats.canceledAppointments += slot.canceledAppointments.length;
        }
    });

    return stats;
}

/**
 * Get date range for appointments query
 * Using specific timestamps that work with the API
 * @returns {Object} Object with start and end timestamps
 */
export function getDateRange() {
    return {
        start: 1738364400000,  // 2025-02-01 00:00:00
        end: 1769900400000     // 2026-02-01 00:00:00
    };
}
