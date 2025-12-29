/**
 * Rax Lead Management System - Admin JavaScript
 */

(function() {
    'use strict';
    
    const API_BASE = raxLMS.apiUrl;
    const NONCE = raxLMS.nonce;
    
    // State management
    let currentView = 'dashboard';
    let currentLeadId = null;
    let viewMode = localStorage.getItem('rax_lms_view_mode') || 'admin'; // 'admin' or 'employee'
    let leadsData = {
        items: [],
        total: 0,
        page: 1,
        per_page: 20,
        total_pages: 1
    };
    let filters = {
        status: '',
        source: '',
        priority: '',
        assigned_user: '',
        search: '',
        date_from: '',
        date_to: ''
    };
    let sortConfig = {
        orderby: 'created_at',
        order: 'DESC'
    };
    let selectedLeads = new Set();
    let calendarState = {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    };
    let segmentFilters = {
        search: '',
        sortBy: 'name', // 'name', 'count', 'created'
        sortOrder: 'asc' // 'asc', 'desc'
    };
    let segmentsData = {
        all: [],
        filtered: []
    };
    
    // Check if user is admin
    const isUserAdmin = raxLMS.isAdmin || false;
    
    // API helper
    const api = {
        async request(endpoint, options = {}) {
            const url = API_BASE + endpoint;
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': NONCE
                },
                ...options
            };
            
            if (options.body) {
                config.body = JSON.stringify(options.body);
            }
            
            try {
                const response = await fetch(url, config);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Request failed');
                }
                
                return data;
            } catch (error) {
                console.error('API Error:', error);
                showNotification(error.message || 'An error occurred', 'error');
                throw error;
            }
        },
        
        get(endpoint) {
            return this.request(endpoint, { method: 'GET' });
        },
        
        post(endpoint, data) {
            return this.request(endpoint, { method: 'POST', body: data });
        },
        
        put(endpoint, data) {
            return this.request(endpoint, { method: 'PUT', body: data });
        },
        
        delete(endpoint) {
            return this.request(endpoint, { method: 'DELETE' });
        }
    };
    
    // Notification system
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notice notice-${type} is-dismissible`;
        notification.style.cssText = 'position: fixed; top: 32px; right: 20px; z-index: 100001; max-width: 400px;';
        notification.innerHTML = `
            <p>${message}</p>
            <button type="button" class="notice-dismiss" onclick="this.parentElement.remove()">
                <span class="screen-reader-text">Dismiss this notice.</span>
            </button>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    // Render functions
    async function renderApp() {
        const app = document.getElementById('rax-lms-app');
        if (!app) return;
        
        app.innerHTML = `
            ${renderNavigation()}
            <div class="rax-lms-container">
                <div id="rax-lms-content" style="margin-top: 88px;">Loading...</div>
            </div>
        `;
        
        const content = document.getElementById('rax-lms-content');
        if (content) {
            if (currentView === 'dashboard') {
                content.innerHTML = await renderDashboard();
            } else if (currentView === 'leads') {
                content.innerHTML = await renderLeadsView();
            } else if (currentView === 'lead-details') {
                content.innerHTML = await renderLeadDetails();
            } else if (currentView === 'analytics') {
                content.innerHTML = await renderAnalytics();
            } else if (currentView === 'segments') {
                content.innerHTML = await renderSegments();
            } else if (currentView === 'tags') {
                content.innerHTML = await renderTags();
            } else if (currentView === 'calendar') {
                content.innerHTML = await renderCalendar();
            } else if (currentView === 'report') {
                content.innerHTML = await renderReport();
            } else if (currentView === 'settings') {
                content.innerHTML = await renderSettings();
            }
        }
        
        attachEventListeners();
    }
    
    function renderNavigation() {
        const isEmployeeView = viewMode === 'employee';
        const showAdminOnly = !isEmployeeView || isUserAdmin;
        
        return `
            <nav class="rax-lms-top-nav">
                <div class="rax-lms-nav-container">
                    <div class="rax-lms-nav-brand" style="cursor: pointer;" id="nav-brand">
                        <div class="rax-lms-nav-logo">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <span class="rax-lms-nav-brand-text">Lead Management</span>
                    </div>
                    
                    <div class="rax-lms-nav-menu">
                        <button class="rax-lms-nav-menu-item ${currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
                            Dashboard
                        </button>
                        <button class="rax-lms-nav-menu-item ${currentView === 'leads' ? 'active' : ''}" data-view="leads">
                            Leads
                        </button>
                        ${showAdminOnly ? `
                            <button class="rax-lms-nav-menu-item ${currentView === 'analytics' ? 'active' : ''}" data-view="analytics">
                                Analytics
                            </button>
                            <button class="rax-lms-nav-menu-item ${currentView === 'segments' ? 'active' : ''}" data-view="segments">
                                Segments
                            </button>
                            <button class="rax-lms-nav-menu-item ${currentView === 'tags' ? 'active' : ''}" data-view="tags">
                                Tags
                            </button>
                        ` : ''}
                        <button class="rax-lms-nav-menu-item ${currentView === 'calendar' ? 'active' : ''}" data-view="calendar">
                            Calendar
                        </button>
                        ${showAdminOnly ? `
                            <button class="rax-lms-nav-menu-item ${currentView === 'report' ? 'active' : ''}" data-view="report">
                                Report
                            </button>
                            <button class="rax-lms-nav-menu-item ${currentView === 'settings' ? 'active' : ''}" data-view="settings">
                                Settings
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="rax-lms-nav-actions">
                        ${currentView === 'dashboard' ? `
                            <button class="rax-lms-nav-action-btn" id="refresh-dashboard" title="Refresh Dashboard">
                                Refresh
                            </button>
                        ` : ''}
                        ${isUserAdmin ? `
                            <div class="rax-lms-view-mode-switch">
                                <span class="rax-lms-view-mode-label ${viewMode === 'employee' ? 'active' : ''}">Employee</span>
                                <label class="rax-lms-view-toggle">
                                    <input type="checkbox" id="view-mode-toggle" ${viewMode === 'admin' ? 'checked' : ''}>
                                    <span class="rax-lms-view-toggle-slider"></span>
                                </label>
                                <span class="rax-lms-view-mode-label ${viewMode === 'admin' ? 'active' : ''}">Admin</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </nav>
        `;
    }
    
    async function renderDashboard() {
        try {
            const isEmployeeView = viewMode === 'employee' && !isUserAdmin;
            
            // In employee view, get only assigned leads
            const leadsQuery = isEmployeeView 
                ? `leads?per_page=10&orderby=created_at&order=DESC&assigned_user=${raxLMS.currentUser}`
                : 'leads?per_page=10&orderby=created_at&order=DESC';
            
            const [stats, recentLeads] = await Promise.all([
                api.get('stats'),
                api.get(leadsQuery)
            ]);
            
            // Filter stats for employee view
            if (isEmployeeView) {
                stats.total = recentLeads.total || 0;
                stats.new_7d = recentLeads.items.filter(l => {
                    const created = new Date(l.created_at);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return created >= weekAgo;
                }).length;
            }
            
            return `
                <div class="rax-lms-dashboard">
                    ${isEmployeeView ? `
                        <div class="rax-lms-dashboard-notice">
                            <div class="rax-lms-dashboard-notice-content">
                                <div class="rax-lms-dashboard-notice-title">Employee View</div>
                                <div class="rax-lms-dashboard-notice-text">You're viewing your assigned leads and tasks. Switch to Admin view for full access.</div>
                            </div>
                        </div>
                    ` : ''}
                    ${renderKPICards(stats)}
                    ${!isEmployeeView ? `
                        <div class="rax-lms-dashboard-section">
                            <div class="rax-lms-dashboard-section-title">Overview</div>
                            <div class="rax-lms-charts-grid">
                                ${renderStatusChart(stats.by_status || {})}
                                ${renderSourceChart(stats.by_source || {})}
                            </div>
                        </div>
                    ` : ''}
                    <div class="rax-lms-dashboard-section">
                        <div class="rax-lms-dashboard-section-title">Recent Leads</div>
                        ${renderActivityFeed(recentLeads.items || [])}
                    </div>
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading dashboard: ${error.message}</div>`;
        }
    }
    
    function renderKPICards(stats) {
        // Calculate trends (mock data for now - can be replaced with actual comparison)
        const trends = {
            total: { value: 12, positive: true },
            new_leads: { value: 5, positive: true },
            conversion: { value: 3, positive: true },
            value: { value: 8, positive: true }
        };
        
        // Format value for display
        const formatValue = (value) => {
            if (value >= 1000) {
                return (value / 1000).toFixed(1) + 'k';
            }
            return formatNumber(value);
        };
        
        return `
            <div class="rax-lms-kpi-grid">
                <div class="rax-lms-kpi-card">
                    <div class="rax-lms-kpi-header">
                        <div class="rax-lms-kpi-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="rax-lms-kpi-content">
                            <div class="rax-lms-kpi-label">Total Leads</div>
                            <div class="rax-lms-kpi-value">${formatNumber(stats.total || 0)}</div>
                            <div class="rax-lms-kpi-trend ${trends.total.positive ? 'positive' : 'negative'}">
                                <span class="rax-lms-kpi-trend-arrow">${trends.total.positive ? '↑' : '↓'}</span>
                                <span>${trends.total.value}% vs last month</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="rax-lms-kpi-card">
                    <div class="rax-lms-kpi-header">
                        <div class="rax-lms-kpi-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="rax-lms-kpi-content">
                            <div class="rax-lms-kpi-label">New Leads</div>
                            <div class="rax-lms-kpi-value">${formatNumber(stats.new_7d || 0)}</div>
                            <div class="rax-lms-kpi-trend ${trends.new_leads.positive ? 'positive' : 'negative'}">
                                <span class="rax-lms-kpi-trend-arrow">${trends.new_leads.positive ? '↑' : '↓'}</span>
                                <span>${trends.new_leads.value}% vs last month</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="rax-lms-kpi-card">
                    <div class="rax-lms-kpi-header">
                        <div class="rax-lms-kpi-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="rax-lms-kpi-content">
                            <div class="rax-lms-kpi-label">Conversion Rate</div>
                            <div class="rax-lms-kpi-value">${stats.conversion_rate || 0}%</div>
                            <div class="rax-lms-kpi-trend ${trends.conversion.positive ? 'positive' : 'negative'}">
                                <span class="rax-lms-kpi-trend-arrow">${trends.conversion.positive ? '↑' : '↓'}</span>
                                <span>${trends.conversion.value}% vs last month</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="rax-lms-kpi-card">
                    <div class="rax-lms-kpi-header">
                        <div class="rax-lms-kpi-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="rax-lms-kpi-content">
                            <div class="rax-lms-kpi-label">Total Value</div>
                            <div class="rax-lms-kpi-value">$${formatValue(stats.estimated_lead_value || 0)}</div>
                            <div class="rax-lms-kpi-trend ${trends.value.positive ? 'positive' : 'negative'}">
                                <span class="rax-lms-kpi-trend-arrow">${trends.value.positive ? '↑' : '↓'}</span>
                                <span>${trends.value.value}% vs last month</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    function renderStatusChart(statusData) {
        const total = Object.values(statusData).reduce((sum, val) => sum + val, 0);
        const statusColors = {
            'new': '#3b82f6',
            'contacted': '#f59e0b',
            'qualified': '#10b981',
            'converted': '#059669',
            'lost': '#ef4444'
        };
        
        const items = Object.entries(statusData)
            .map(([status, count]) => ({
                status,
                count,
                percentage: total > 0 ? (count / total * 100).toFixed(1) : 0,
                color: statusColors[status] || '#6b7280'
            }))
            .sort((a, b) => b.count - a.count);
        
        return `
            <div class="rax-lms-chart-card">
                <div class="rax-lms-chart-title">Leads by Status</div>
                <div class="rax-lms-chart-container">
                    ${items.length > 0 ? `
                        <div style="width: 100%;">
                            ${items.map(item => `
                                <div style="margin-bottom: 20px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background: ${item.color};"></span>
                                            <span style="text-transform: capitalize; font-weight: 600; color: var(--rax-gray-900);">${item.status}</span>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="font-weight: 600; color: var(--rax-gray-900);">${item.count}</span>
                                            <span style="color: var(--rax-gray-500); font-size: 12px;">${item.percentage}%</span>
                                        </div>
                                    </div>
                                    <div style="height: 10px; background: var(--rax-gray-200); border-radius: 5px; overflow: hidden;">
                                        <div style="height: 100%; width: ${item.percentage}%; background: ${item.color}; transition: width 0.5s ease-out; border-radius: 5px;"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="rax-lms-empty">No data available</div>'}
                </div>
            </div>
        `;
    }
    
    function renderSourceChart(sourceData) {
        const total = Object.values(sourceData).reduce((sum, val) => sum + val, 0);
        const sourceColors = {
            'fluent_forms': '#4338ca',
            'fluent_crm': '#be185d',
            'fluent_support': '#1e40af',
            'fluent_booking': '#92400e',
            'ninja_tables': '#065f46',
            'wp_social_ninja': '#6b21a8',
            'manual': '#6b7280'
        };
        
        const items = Object.entries(sourceData)
            .map(([source, count]) => ({
                source,
                count,
                percentage: total > 0 ? (count / total * 100).toFixed(1) : 0,
                color: sourceColors[source] || '#6b7280'
            }))
            .sort((a, b) => b.count - a.count);
        
        return `
            <div class="rax-lms-chart-card">
                <div class="rax-lms-chart-title">Leads by Source</div>
                <div class="rax-lms-chart-container">
                    ${items.length > 0 ? `
                        <div style="width: 100%;">
                            ${items.map(item => `
                                <div style="margin-bottom: 20px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background: ${item.color};"></span>
                                            <span style="font-weight: 600; color: var(--rax-gray-900);">${formatSourceName(item.source)}</span>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="font-weight: 600; color: var(--rax-gray-900);">${item.count}</span>
                                            <span style="color: var(--rax-gray-500); font-size: 12px;">${item.percentage}%</span>
                                        </div>
                                    </div>
                                    <div style="height: 10px; background: var(--rax-gray-200); border-radius: 5px; overflow: hidden;">
                                        <div style="height: 100%; width: ${item.percentage}%; background: ${item.color}; transition: width 0.5s ease-out; border-radius: 5px;"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="rax-lms-empty">No data available</div>'}
                </div>
            </div>
        `;
    }
    
    function renderActivityFeed(leads) {
        return `
            <div class="rax-lms-activity-feed">
                ${leads.length > 0 ? `
                    <div class="rax-lms-activity-list">
                        ${leads.map(lead => `
                            <div class="rax-lms-activity-item" onclick="window.raxLMSViewLead(${lead.id})">
                                <div class="rax-lms-activity-avatar">
                                    ${renderAvatar(lead.name, null, 40)}
                                </div>
                                <div class="rax-lms-activity-content">
                                    <div class="rax-lms-activity-text">
                                        <span class="rax-lms-activity-name">${escapeHtml(lead.name)}</span>
                                        <span class="rax-lms-activity-email">${escapeHtml(lead.email)}</span>
                                    </div>
                                    <div class="rax-lms-activity-meta">
                                        <span class="rax-lms-badge rax-lms-badge-source rax-lms-badge-source-${lead.source}">${formatSourceName(lead.source)}</span>
                                        <span class="rax-lms-activity-date">${formatDate(lead.created_at)}</span>
                                    </div>
                                </div>
                                <div class="rax-lms-activity-status">
                                    <span class="rax-lms-badge rax-lms-badge-status-${lead.status}">${lead.status}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="rax-lms-empty">No recent leads</div>'}
            </div>
        `;
    }
    
    async function renderLeadsView() {
        const isEmployeeView = viewMode === 'employee';
        
        // In employee view, filter to show only assigned leads
        if (isEmployeeView && !isUserAdmin) {
            filters.assigned_user = raxLMS.currentUser;
        }
        
        const tableHtml = await renderLeadsTable();
        return `
            <div>
                ${renderFilters()}
                ${tableHtml}
            </div>
        `;
    }
    
    function renderFilters() {
        const users = raxLMS.users || [];
        const isEmployeeView = viewMode === 'employee' && !isUserAdmin;
        
        return `
            <div class="rax-lms-filters">
                <div class="rax-lms-filter-group">
                    <label class="rax-lms-filter-label">Search</label>
                    <input type="text" class="rax-lms-filter-input" id="filter-search" 
                           placeholder="Name or email..." value="${filters.search}">
                </div>
                <div class="rax-lms-filter-group">
                    <label class="rax-lms-filter-label">Status</label>
                    <select class="rax-lms-filter-select" id="filter-status">
                        <option value="">All Statuses</option>
                        <option value="new" ${filters.status === 'new' ? 'selected' : ''}>New</option>
                        <option value="contacted" ${filters.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="qualified" ${filters.status === 'qualified' ? 'selected' : ''}>Qualified</option>
                        <option value="converted" ${filters.status === 'converted' ? 'selected' : ''}>Converted</option>
                        <option value="lost" ${filters.status === 'lost' ? 'selected' : ''}>Lost</option>
                    </select>
                </div>
                ${!isEmployeeView ? `
                    <div class="rax-lms-filter-group">
                        <label class="rax-lms-filter-label">Source</label>
                        <select class="rax-lms-filter-select" id="filter-source">
                            <option value="">All Sources</option>
                            <option value="fluent_forms" ${filters.source === 'fluent_forms' ? 'selected' : ''}>Fluent Forms</option>
                            <option value="fluent_crm" ${filters.source === 'fluent_crm' ? 'selected' : ''}>Fluent CRM</option>
                            <option value="fluent_support" ${filters.source === 'fluent_support' ? 'selected' : ''}>Fluent Support</option>
                            <option value="fluent_booking" ${filters.source === 'fluent_booking' ? 'selected' : ''}>Fluent Booking</option>
                            <option value="ninja_tables" ${filters.source === 'ninja_tables' ? 'selected' : ''}>Ninja Tables</option>
                            <option value="wp_social_ninja" ${filters.source === 'wp_social_ninja' ? 'selected' : ''}>WP Social Ninja</option>
                            <option value="manual" ${filters.source === 'manual' ? 'selected' : ''}>Manual</option>
                        </select>
                    </div>
                ` : ''}
                <div class="rax-lms-filter-group">
                    <label class="rax-lms-filter-label">Priority</label>
                    <select class="rax-lms-filter-select" id="filter-priority">
                        <option value="">All Priorities</option>
                        <option value="low" ${filters.priority === 'low' ? 'selected' : ''}>Low</option>
                        <option value="medium" ${filters.priority === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="high" ${filters.priority === 'high' ? 'selected' : ''}>High</option>
                    </select>
                </div>
                ${!isEmployeeView ? `
                    <div class="rax-lms-filter-group">
                        <label class="rax-lms-filter-label">Assigned To</label>
                        <select class="rax-lms-filter-select" id="filter-assigned">
                            <option value="">All Users</option>
                            ${users.map(user => `
                                <option value="${user.id}" ${filters.assigned_user == user.id ? 'selected' : ''}>
                                    ${escapeHtml(user.name)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                ` : ''}
                <div class="rax-lms-filter-actions">
                    <button class="rax-lms-btn rax-lms-btn-primary" id="apply-filters">Apply Filters</button>
                    <button class="rax-lms-btn rax-lms-btn-secondary" id="reset-filters">Reset</button>
                    ${!isEmployeeView ? `
                        <button class="rax-lms-btn rax-lms-btn-primary" id="add-lead-btn">+ Add Lead</button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    async function renderLeadsTable() {
        try {
            const queryParams = new URLSearchParams({
                ...filters,
                ...sortConfig,
                page: leadsData.page,
                per_page: leadsData.per_page
            });
            
            const response = await api.get(`leads?${queryParams}`);
            leadsData = response;
            
            if (leadsData.items.length === 0) {
                return `
                    <div class="rax-lms-table-container">
                        <div class="rax-lms-empty">
                            <div class="rax-lms-empty-icon">📋</div>
                            <p>No leads found</p>
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="rax-lms-table-container">
                    ${selectedLeads.size > 0 && viewMode === 'admin' ? renderBulkActions() : ''}
                    <table class="rax-lms-table">
                        <thead>
                            <tr>
                                ${viewMode === 'admin' ? '<th><input type="checkbox" class="rax-lms-checkbox" id="select-all"></th>' : ''}
                                <th class="sortable" data-sort="name">
                                    Name ${getSortIcon('name')}
                                </th>
                                <th class="sortable" data-sort="email">
                                    Email ${getSortIcon('email')}
                                </th>
                                ${viewMode === 'admin' ? `
                                    <th class="sortable" data-sort="source">
                                        Source ${getSortIcon('source')}
                                    </th>
                                ` : ''}
                                <th class="sortable" data-sort="status">
                                    Status ${getSortIcon('status')}
                                </th>
                                <th class="sortable" data-sort="priority">
                                    Priority ${getSortIcon('priority')}
                                </th>
                                ${viewMode === 'admin' ? `
                                    <th class="sortable" data-sort="assigned_user">
                                        Assigned To ${getSortIcon('assigned_user')}
                                    </th>
                                ` : ''}
                                <th class="sortable" data-sort="created_at">
                                    Created ${getSortIcon('created_at')}
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${leadsData.items.map(lead => renderLeadRow(lead)).join('')}
                        </tbody>
                    </table>
                    ${renderPagination()}
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading leads: ${error.message}</div>`;
        }
    }
    
    function renderBulkActions() {
        return `
            <div class="rax-lms-bulk-actions">
                <span style="margin-right: 16px;">${selectedLeads.size} selected</span>
                <select id="bulk-status" class="rax-lms-filter-select" style="width: 150px;">
                    <option value="">Change Status</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="converted">Converted</option>
                    <option value="lost">Lost</option>
                </select>
                <button class="rax-lms-btn rax-lms-btn-sm rax-lms-btn-primary" id="bulk-apply">Apply</button>
                <button class="rax-lms-btn rax-lms-btn-sm rax-lms-btn-secondary" id="bulk-clear">Clear Selection</button>
            </div>
        `;
    }
    
    function renderLeadRow(lead) {
        const assignedUser = lead.assigned_user ? getUserName(lead.assigned_user) : 'Unassigned';
        const isSelected = selectedLeads.has(lead.id);
        const isEmployeeView = viewMode === 'employee' && !isUserAdmin;
        
        return `
            <tr>
                ${viewMode === 'admin' ? `
                    <td>
                        <input type="checkbox" class="rax-lms-checkbox lead-checkbox" 
                               data-lead-id="${lead.id}" ${isSelected ? 'checked' : ''}>
                    </td>
                ` : ''}
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${renderAvatar(lead.name, null, 32)}
                        <strong>${escapeHtml(lead.name)}</strong>
                    </div>
                </td>
                <td>${escapeHtml(lead.email)}</td>
                ${viewMode === 'admin' ? `
                    <td><span class="rax-lms-badge rax-lms-badge-source rax-lms-badge-source-${lead.source}">${formatSourceName(lead.source)}</span></td>
                ` : ''}
                <td><span class="rax-lms-badge rax-lms-badge-status-${lead.status}">${lead.status}</span></td>
                <td><span class="rax-lms-badge rax-lms-badge-priority-${lead.priority}">${lead.priority}</span></td>
                ${viewMode === 'admin' ? `
                    <td>
                        ${lead.assigned_user ? `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${renderAvatar(assignedUser, lead.assigned_user, 28)}
                                <span>${escapeHtml(assignedUser)}</span>
                            </div>
                        ` : '<span style="color: var(--rax-gray-400);">Unassigned</span>'}
                    </td>
                ` : ''}
                <td>${formatDate(lead.created_at)}</td>
                <td>
                    <button class="rax-lms-btn rax-lms-btn-sm rax-lms-btn-secondary view-lead" 
                            data-lead-id="${lead.id}">View</button>
                </td>
            </tr>
        `;
    }
    
    function renderPagination() {
        if (leadsData.total_pages <= 1) return '';
        
        return `
            <div class="rax-lms-pagination">
                <button class="rax-lms-pagination-btn" id="prev-page" 
                        ${leadsData.page === 1 ? 'disabled' : ''}>Previous</button>
                <span class="rax-lms-pagination-info">
                    Page ${leadsData.page} of ${leadsData.total_pages} 
                    (${leadsData.total} total)
                </span>
                <button class="rax-lms-pagination-btn" id="next-page" 
                        ${leadsData.page === leadsData.total_pages ? 'disabled' : ''}>Next</button>
            </div>
        `;
    }
    
    async function renderLeadDetails() {
        if (!currentLeadId) return '<div class="rax-lms-loading">No lead selected</div>';
        
        try {
            const lead = await api.get(`leads/${currentLeadId}`);
            const activities = await api.get(`leads/${currentLeadId}/activities`);
            
            return `
                <div>
                    <button class="rax-lms-btn rax-lms-btn-secondary" id="back-to-leads" 
                            style="margin-bottom: 20px;">← Back to Leads</button>
                    <div class="rax-lms-details-container">
                        <div class="rax-lms-details-main">
                            ${renderLeadProfile(lead)}
                            ${renderActivityTimeline(activities)}
                            ${renderNotesSection(lead.id, activities)}
                        </div>
                        <div class="rax-lms-details-sidebar">
                            ${renderLeadActions(lead)}
                            ${renderLeadMetadata(lead)}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading lead: ${error.message}</div>`;
        }
    }
    
    function renderLeadProfile(lead) {
        return `
            <div class="rax-lms-details-card">
                <div class="rax-lms-details-card-title">Lead Profile</div>
                <div class="rax-lms-details-field" style="display: flex; align-items: center; gap: 16px; padding: 16px 0;">
                    ${renderAvatar(lead.name, null, 64)}
                    <div>
                        <div class="rax-lms-details-label">Name</div>
                        <div class="rax-lms-details-value" style="font-size: 18px; font-weight: 600;">${escapeHtml(lead.name)}</div>
                    </div>
                </div>
                <div class="rax-lms-details-field">
                    <div class="rax-lms-details-label">Email</div>
                    <div class="rax-lms-details-value">${escapeHtml(lead.email)}</div>
                </div>
                ${lead.phone ? `
                    <div class="rax-lms-details-field">
                        <div class="rax-lms-details-label">Phone</div>
                        <div class="rax-lms-details-value">${escapeHtml(lead.phone)}</div>
                    </div>
                ` : ''}
                <div class="rax-lms-details-field">
                    <div class="rax-lms-details-label">Source</div>
                    <div class="rax-lms-details-value">
                        <span class="rax-lms-badge rax-lms-badge-source rax-lms-badge-source-${lead.source}">${formatSourceName(lead.source)}</span>
                    </div>
                </div>
                ${lead.tags && lead.tags.length > 0 ? `
                    <div class="rax-lms-details-field">
                        <div class="rax-lms-details-label">Tags</div>
                        <div class="rax-lms-details-tags">
                            ${lead.tags.map(tag => `<span class="rax-lms-tag">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    function renderLeadActions(lead) {
        const users = raxLMS.users || [];
        const isEmployeeView = viewMode === 'employee' && !isUserAdmin;
        
        return `
            <div class="rax-lms-details-card">
                <div class="rax-lms-details-card-title">Quick Actions</div>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
                    <button class="rax-lms-btn rax-lms-btn-primary" id="send-email-btn" 
                            data-lead-id="${lead.id}" data-email="${escapeHtml(lead.email)}" 
                            style="width: 100%; justify-content: center;">
                        📧 Send Email
                    </button>
                    <button class="rax-lms-btn rax-lms-btn-secondary" id="schedule-followup-btn" 
                            data-lead-id="${lead.id}" style="width: 100%; justify-content: center;">
                        📅 Schedule Follow-up
                    </button>
                    ${!isEmployeeView ? `
                        <button class="rax-lms-btn rax-lms-btn-secondary" id="edit-lead-btn" 
                                data-lead-id="${lead.id}" style="width: 100%; justify-content: center;">
                            ✏️ Edit Lead
                        </button>
                    ` : ''}
                </div>
                <div class="rax-lms-details-field">
                    <div class="rax-lms-details-label">Status</div>
                    <select class="rax-lms-form-input" id="lead-status" data-lead-id="${lead.id}">
                        <option value="new" ${lead.status === 'new' ? 'selected' : ''}>New</option>
                        <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="qualified" ${lead.status === 'qualified' ? 'selected' : ''}>Qualified</option>
                        <option value="converted" ${lead.status === 'converted' ? 'selected' : ''}>Converted</option>
                        <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Lost</option>
                    </select>
                </div>
                <div class="rax-lms-details-field">
                    <div class="rax-lms-details-label">Priority</div>
                    <select class="rax-lms-form-input" id="lead-priority" data-lead-id="${lead.id}">
                        <option value="low" ${lead.priority === 'low' ? 'selected' : ''}>Low</option>
                        <option value="medium" ${lead.priority === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="high" ${lead.priority === 'high' ? 'selected' : ''}>High</option>
                    </select>
                </div>
                ${!isEmployeeView ? `
                    <div class="rax-lms-details-field">
                        <div class="rax-lms-details-label">Assigned To</div>
                        <select class="rax-lms-form-input" id="lead-assigned" data-lead-id="${lead.id}">
                            <option value="">Unassigned</option>
                            ${users.map(user => `
                                <option value="${user.id}" ${lead.assigned_user == user.id ? 'selected' : ''}>
                                    ${escapeHtml(user.name)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                ` : ''}
                <div style="margin-top: 16px;">
                    <button class="rax-lms-btn rax-lms-btn-primary" id="save-lead-changes" 
                            style="width: 100%;">Save Changes</button>
                </div>
            </div>
        `;
    }
    
    function renderLeadMetadata(lead) {
        return `
            <div class="rax-lms-details-card">
                <div class="rax-lms-details-card-title">Metadata</div>
                <div class="rax-lms-details-field">
                    <div class="rax-lms-details-label">Created</div>
                    <div class="rax-lms-details-value">${formatDate(lead.created_at)}</div>
                </div>
                <div class="rax-lms-details-field">
                    <div class="rax-lms-details-label">Last Updated</div>
                    <div class="rax-lms-details-value">${formatDate(lead.updated_at)}</div>
                </div>
            </div>
        `;
    }
    
    function renderActivityTimeline(activities) {
        return `
            <div class="rax-lms-details-card">
                <div class="rax-lms-details-card-title">Activity Timeline</div>
                <div class="rax-lms-timeline">
                    ${activities.length > 0 ? activities.map(activity => `
                        <div class="rax-lms-timeline-item">
                            <div class="rax-lms-timeline-content">
                                <div class="rax-lms-timeline-text">${escapeHtml(activity.content)}</div>
                                <div class="rax-lms-timeline-meta">
                                    ${activity.created_by_name || 'System'} • ${formatDate(activity.created_at)}
                                </div>
                            </div>
                        </div>
                    `).join('') : '<div class="rax-lms-empty">No activity yet</div>'}
                </div>
            </div>
        `;
    }
    
    function renderNotesSection(leadId, activities) {
        const notes = activities.filter(a => a.type === 'note');
        
        return `
            <div class="rax-lms-details-card">
                <div class="rax-lms-details-card-title">Notes</div>
                <div class="rax-lms-notes-form">
                    <textarea class="rax-lms-notes-textarea" id="new-note" 
                              placeholder="Add a note..."></textarea>
                    <button class="rax-lms-btn rax-lms-btn-primary" id="add-note-btn" 
                            data-lead-id="${leadId}" style="margin-top: 8px;">Add Note</button>
                </div>
                ${notes.length > 0 ? notes.map(note => `
                    <div class="rax-lms-note-item">
                        <div class="rax-lms-note-content">${escapeHtml(note.content)}</div>
                        <div class="rax-lms-note-meta">
                            ${note.created_by_name || 'System'} • ${formatDate(note.created_at)}
                        </div>
                    </div>
                `).join('') : '<div class="rax-lms-empty">No notes yet</div>'}
            </div>
        `;
    }
    
    function renderAddLeadModal() {
        return `
            <div class="rax-lms-drawer-overlay" id="add-lead-drawer-overlay">
                <div class="rax-lms-drawer" id="add-lead-drawer">
                    <div class="rax-lms-drawer-header">
                        <h2 class="rax-lms-drawer-title">Add New Lead</h2>
                        <button class="rax-lms-drawer-close" id="close-drawer">×</button>
                    </div>
                    <div class="rax-lms-drawer-body">
                        <form id="add-lead-form">
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Name *</label>
                                <input type="text" class="rax-lms-form-input" name="name" required>
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Email *</label>
                                <input type="email" class="rax-lms-form-input" name="email" required>
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Phone</label>
                                <input type="tel" class="rax-lms-form-input" name="phone">
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Source</label>
                                <select class="rax-lms-form-input" name="source">
                                    <option value="manual">Manual</option>
                                    <option value="fluent_forms">Fluent Forms</option>
                                    <option value="fluent_crm">Fluent CRM</option>
                                    <option value="fluent_support">Fluent Support</option>
                                    <option value="fluent_booking">Fluent Booking</option>
                                    <option value="ninja_tables">Ninja Tables</option>
                                    <option value="wp_social_ninja">WP Social Ninja</option>
                                </select>
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Status</label>
                                <select class="rax-lms-form-input" name="status">
                                    <option value="new">New</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="converted">Converted</option>
                                    <option value="lost">Lost</option>
                                </select>
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Priority</label>
                                <select class="rax-lms-form-input" name="priority">
                                    <option value="low">Low</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Company</label>
                                <input type="text" class="rax-lms-form-input" name="company">
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Notes</label>
                                <textarea class="rax-lms-form-input" name="notes" rows="4" style="resize: vertical;"></textarea>
                            </div>
                            <div class="rax-lms-drawer-actions">
                                <button type="button" class="rax-lms-btn rax-lms-btn-secondary" id="cancel-add-lead">Cancel</button>
                                <button type="submit" class="rax-lms-btn rax-lms-btn-primary">Add Lead</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Event handlers
    function attachEventListeners() {
        // Navigation - Brand logo click
        const navBrand = document.getElementById('nav-brand');
        if (navBrand) {
            navBrand.addEventListener('click', () => {
                currentView = 'dashboard';
                currentLeadId = null;
                renderApp();
            });
        }
        
        // Navigation - Menu items
        document.querySelectorAll('.rax-lms-nav-menu-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view || e.target.closest('.rax-lms-nav-menu-item')?.dataset.view;
                if (view) {
                    currentView = view;
                    currentLeadId = null;
                    renderApp();
                }
            });
        });
        
        // View mode toggle
        const viewModeToggle = document.getElementById('view-mode-toggle');
        if (viewModeToggle) {
            viewModeToggle.addEventListener('change', (e) => {
                viewMode = e.target.checked ? 'admin' : 'employee';
                localStorage.setItem('rax_lms_view_mode', viewMode);
                
                // If switching to employee view and on admin-only page, go to dashboard
                if (viewMode === 'employee') {
                    const adminOnlyPages = ['analytics', 'segments', 'tags', 'report', 'settings'];
                    if (adminOnlyPages.includes(currentView)) {
                        currentView = 'dashboard';
                    }
                }
                
                renderApp();
            });
        }
        
        // Refresh dashboard
        const refreshBtn = document.getElementById('refresh-dashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = 'Refreshing...';
                await renderApp();
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = 'Refresh';
            });
        }
        
        // Filters
        const applyFilters = document.getElementById('apply-filters');
        if (applyFilters) {
            applyFilters.addEventListener('click', async () => {
                filters.search = document.getElementById('filter-search')?.value || '';
                filters.status = document.getElementById('filter-status')?.value || '';
                filters.source = document.getElementById('filter-source')?.value || '';
                filters.priority = document.getElementById('filter-priority')?.value || '';
                filters.assigned_user = document.getElementById('filter-assigned')?.value || '';
                leadsData.page = 1;
                renderApp();
            });
        }
        
        const resetFilters = document.getElementById('reset-filters');
        if (resetFilters) {
            resetFilters.addEventListener('click', () => {
                filters = {
                    status: '',
                    source: '',
                    priority: '',
                    assigned_user: '',
                    search: '',
                    date_from: '',
                    date_to: ''
                };
                leadsData.page = 1;
                renderApp();
            });
        }
        
        // Add lead
        const addLeadBtn = document.getElementById('add-lead-btn');
        if (addLeadBtn) {
            addLeadBtn.addEventListener('click', () => {
                document.body.insertAdjacentHTML('beforeend', renderAddLeadModal());
                // Trigger slide-in animation
                setTimeout(() => {
                    const drawer = document.getElementById('add-lead-drawer');
                    const overlay = document.getElementById('add-lead-drawer-overlay');
                    if (drawer && overlay) {
                        drawer.classList.add('rax-lms-drawer-open');
                        overlay.classList.add('rax-lms-drawer-overlay-visible');
                    }
                }, 10);
                attachModalListeners();
            });
        }
        
        // View lead
        document.querySelectorAll('.view-lead').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentLeadId = parseInt(e.target.dataset.leadId);
                currentView = 'lead-details';
                renderApp();
            });
        });
        
        // Back to leads
        const backBtn = document.getElementById('back-to-leads');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                currentView = 'leads';
                currentLeadId = null;
                renderApp();
            });
        }
        
        // Pagination
        const prevPage = document.getElementById('prev-page');
        if (prevPage) {
            prevPage.addEventListener('click', () => {
                if (leadsData.page > 1) {
                    leadsData.page--;
                    renderApp();
                }
            });
        }
        
        const nextPage = document.getElementById('next-page');
        if (nextPage) {
            nextPage.addEventListener('click', () => {
                if (leadsData.page < leadsData.total_pages) {
                    leadsData.page++;
                    renderApp();
                }
            });
        }
        
        // Bulk actions
        const selectAll = document.getElementById('select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const checked = e.target.checked;
                document.querySelectorAll('.lead-checkbox').forEach(cb => {
                    cb.checked = checked;
                    const leadId = parseInt(cb.dataset.leadId);
                    if (checked) {
                        selectedLeads.add(leadId);
                    } else {
                        selectedLeads.delete(leadId);
                    }
                });
                renderApp();
            });
        }
        
        document.querySelectorAll('.lead-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const leadId = parseInt(e.target.dataset.leadId);
                if (e.target.checked) {
                    selectedLeads.add(leadId);
                } else {
                    selectedLeads.delete(leadId);
                }
                renderApp();
            });
        });
        
        const bulkApply = document.getElementById('bulk-apply');
        if (bulkApply) {
            bulkApply.addEventListener('click', async () => {
                const status = document.getElementById('bulk-status')?.value;
                if (!status || selectedLeads.size === 0) return;
                
                try {
                    await api.post('leads/bulk', {
                        ids: Array.from(selectedLeads),
                        updates: { status }
                    });
                    selectedLeads.clear();
                    showNotification('Leads updated successfully', 'success');
                    renderApp();
                } catch (error) {
                    // Error handled in API
                }
            });
        }
        
        const bulkClear = document.getElementById('bulk-clear');
        if (bulkClear) {
            bulkClear.addEventListener('click', () => {
                selectedLeads.clear();
                renderApp();
            });
        }
        
        // Lead details actions
        const saveChanges = document.getElementById('save-lead-changes');
        if (saveChanges) {
            saveChanges.addEventListener('click', async () => {
                const leadId = parseInt(document.getElementById('lead-status')?.dataset.leadId);
                if (!leadId) return;
                
                const updates = {
                    status: document.getElementById('lead-status')?.value,
                    priority: document.getElementById('lead-priority')?.value,
                    assigned_user: document.getElementById('lead-assigned')?.value || null
                };
                
                try {
                    await api.put(`leads/${leadId}`, updates);
                    showNotification('Lead updated successfully', 'success');
                    renderApp();
                } catch (error) {
                    // Error handled in API
                }
            });
        }
        
        const addNoteBtn = document.getElementById('add-note-btn');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', async () => {
                const leadId = parseInt(addNoteBtn.dataset.leadId);
                const content = document.getElementById('new-note')?.value.trim();
                
                if (!content) {
                    showNotification('Please enter a note', 'error');
                    return;
                }
                
                try {
                    await api.post(`leads/${leadId}/activities`, {
                        type: 'note',
                        content: content
                    });
                    document.getElementById('new-note').value = '';
                    showNotification('Note added successfully', 'success');
                    renderApp();
                } catch (error) {
                    // Error handled in API
                }
            });
        }
        
        // Quick actions
        const sendEmailBtn = document.getElementById('send-email-btn');
        if (sendEmailBtn) {
            sendEmailBtn.addEventListener('click', () => {
                const email = sendEmailBtn.dataset.email;
                window.location.href = `mailto:${email}`;
            });
        }
        
        const scheduleFollowupBtn = document.getElementById('schedule-followup-btn');
        if (scheduleFollowupBtn) {
            scheduleFollowupBtn.addEventListener('click', () => {
                showScheduleModal(parseInt(scheduleFollowupBtn.dataset.leadId));
            });
        }
        
        const editLeadBtn = document.getElementById('edit-lead-btn');
        if (editLeadBtn) {
            editLeadBtn.addEventListener('click', () => {
                showEditLeadModal(parseInt(editLeadBtn.dataset.leadId));
            });
        }
        
        // Sortable columns
        document.querySelectorAll('.sortable').forEach(th => {
            th.style.cursor = 'pointer';
            th.addEventListener('click', () => {
                const sortField = th.dataset.sort;
                if (sortConfig.orderby === sortField) {
                    sortConfig.order = sortConfig.order === 'ASC' ? 'DESC' : 'ASC';
                } else {
                    sortConfig.orderby = sortField;
                    sortConfig.order = 'ASC';
                }
                renderApp();
            });
        });
        
        // Tags page events
        const tagSearch = document.getElementById('tag-search');
        if (tagSearch) {
            tagSearch.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                document.querySelectorAll('#tags-table-body tr').forEach(row => {
                    const tagName = row.dataset.tagName.toLowerCase();
                    row.style.display = tagName.includes(searchTerm) ? '' : 'none';
                });
            });
        }
        
        // Create tag button
        const createTagBtn = document.getElementById('create-tag-btn');
        if (createTagBtn) {
            createTagBtn.addEventListener('click', () => {
                showCreateTagModal();
            });
        }
        
        document.querySelectorAll('.edit-tag').forEach(btn => {
            btn.addEventListener('click', () => {
                const tagName = btn.dataset.tag;
                showEditTagModal(tagName);
            });
        });
        
        document.querySelectorAll('.delete-tag').forEach(btn => {
            btn.addEventListener('click', () => {
                const tagName = btn.dataset.tag;
                if (confirm(`Are you sure you want to delete the tag "${tagName}"? This will remove the tag from all leads.`)) {
                    api.delete(`tags/${encodeURIComponent(tagName)}`)
                        .then(() => {
                            showNotification('Tag deleted successfully', 'success');
                            renderApp();
                        })
                        .catch((error) => {
                            showNotification(error.message || 'Failed to delete tag', 'error');
                        });
                }
            });
        });
        
        // Calendar page events
        const prevMonth = document.getElementById('prev-month');
        if (prevMonth) {
            prevMonth.addEventListener('click', () => {
                calendarState.month--;
                if (calendarState.month < 1) {
                    calendarState.month = 12;
                    calendarState.year--;
                }
                renderApp();
            });
        }
        
        const nextMonth = document.getElementById('next-month');
        if (nextMonth) {
            nextMonth.addEventListener('click', () => {
                calendarState.month++;
                if (calendarState.month > 12) {
                    calendarState.month = 1;
                    calendarState.year++;
                }
                renderApp();
            });
        }
        
        // Report page events
        // Date range buttons
        document.querySelectorAll('.rax-lms-report-date-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                // Remove active class from all buttons
                document.querySelectorAll('.rax-lms-report-date-btn').forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                
                const days = parseInt(e.target.dataset.days);
                const today = new Date();
                const dateFrom = new Date();
                dateFrom.setDate(today.getDate() - days);
                
                // Helper function to format date as YYYY-MM-DD
                const formatDateForAPI = (date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };
                
                // Update date inputs
                const dateFromInput = document.getElementById('report-date-from');
                const dateToInput = document.getElementById('report-date-to');
                if (dateFromInput) dateFromInput.value = formatDateForAPI(dateFrom);
                if (dateToInput) dateToInput.value = formatDateForAPI(today);
                
                try {
                    await api.get(`reports/overview?date_from=${formatDateForAPI(dateFrom)}&date_to=${formatDateForAPI(today)}`);
                    renderApp();
                } catch (error) {
                    showNotification('Error loading report data', 'error');
                }
            });
        });
        
        // Custom date inputs
        const reportDateFrom = document.getElementById('report-date-from');
        const reportDateTo = document.getElementById('report-date-to');
        if (reportDateFrom && reportDateTo) {
            const updateReportDates = async () => {
                // Remove active class from all date buttons
                document.querySelectorAll('.rax-lms-report-date-btn').forEach(b => b.classList.remove('active'));
                
                const dateFrom = reportDateFrom.value;
                const dateTo = reportDateTo.value;
                
                if (dateFrom && dateTo) {
                    try {
                        await api.get(`reports/overview?date_from=${dateFrom}&date_to=${dateTo}`);
                        renderApp();
                    } catch (error) {
                        showNotification('Error loading report data', 'error');
                    }
                }
            };
            
            reportDateFrom.addEventListener('change', updateReportDates);
            reportDateTo.addEventListener('change', updateReportDates);
        }
        
        const exportReport = document.getElementById('export-report');
        if (exportReport) {
            exportReport.addEventListener('click', () => {
                showNotification('Export functionality coming soon', 'info');
            });
        }
        
        // Report type cards
        document.querySelectorAll('.rax-lms-report-type-card').forEach(card => {
            card.addEventListener('click', () => {
                // Remove active class from all cards
                document.querySelectorAll('.rax-lms-report-type-card').forEach(c => c.classList.remove('active'));
                // Add active class to clicked card
                card.classList.add('active');
                // Update report title
                const title = card.querySelector('.rax-lms-report-type-title').textContent;
                const titleElement = document.querySelector('.rax-lms-report-title');
                if (titleElement) titleElement.textContent = title;
            });
        });
        
        // Render chart after report page loads
        if (currentView === 'report') {
            setTimeout(() => renderReportChart(), 100);
        }
    }
    
    async function renderReportChart() {
        try {
            const chartContainer = document.getElementById('report-monthly-chart');
            if (!chartContainer) return;
            
            // Get date range from inputs
            const dateFromInput = document.getElementById('report-date-from');
            const dateToInput = document.getElementById('report-date-to');
            const dateFrom = dateFromInput?.value || '';
            const dateTo = dateToInput?.value || '';
            
            // Fetch report data
            const reportData = await api.get(`reports/overview?date_from=${dateFrom}&date_to=${dateTo}`);
            
            // Generate mock monthly data (in a real app, this would come from the API)
            const monthlyData = [];
            const startDate = new Date(dateFrom);
            const endDate = new Date(dateTo);
            const months = [];
            
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const monthKey = currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                if (!months.includes(monthKey)) {
                    months.push(monthKey);
                    monthlyData.push({
                        date: monthKey,
                        count: Math.floor(Math.random() * 20) + 1
                    });
                }
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
            
            // If no monthly data, create default
            if (monthlyData.length === 0) {
                monthlyData.push({
                    date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    count: reportData.total_leads || 0
                });
            }
            
            // Render chart using existing renderCustomChart function
            renderCustomChart('report-monthly-chart', monthlyData, 'count', 'Monthly Performance');
        } catch (error) {
            console.error('Error rendering report chart:', error);
        }
        
        // Segments page events
        const createSegmentBtn = document.getElementById('create-segment-btn');
        if (createSegmentBtn) {
            createSegmentBtn.addEventListener('click', () => {
                showNotification('Create segment functionality coming soon', 'info');
            });
        }
        
        // Settings page events
        const saveSettings = document.getElementById('save-settings');
        if (saveSettings) {
            saveSettings.addEventListener('click', async () => {
                const settings = {
                    profile: {
                        name: document.getElementById('profile-name')?.value,
                        email: document.getElementById('profile-email')?.value,
                        role: document.getElementById('profile-role')?.value,
                        timezone: document.getElementById('profile-timezone')?.value
                    },
                    lead_preferences: {
                        default_status: document.getElementById('default-status')?.value,
                        auto_assignment: document.getElementById('auto-assignment')?.checked,
                        lead_scoring: document.getElementById('lead-scoring')?.checked
                    },
                    features: {
                        duplicate_detection: document.getElementById('duplicate-detection')?.checked,
                        email_notifications: document.getElementById('email-notifications')?.checked,
                        activity_logging: document.getElementById('activity-logging')?.checked
                    }
                };
                
                try {
                    await api.put('settings', settings);
                    showNotification('Settings saved successfully', 'success');
                } catch (error) {
                    // Error handled in API
                }
            });
        }
        
        // Render charts after analytics page loads
        if (currentView === 'analytics') {
            setTimeout(() => renderAnalyticsCharts(), 100);
        }
    }
    
    async function renderAnalyticsCharts() {
        try {
            const analytics = await api.get('analytics');
            
            // Lead Trends Chart
            if (document.getElementById('lead-trends-chart')) {
                renderCustomChart('lead-trends-chart', analytics.lead_trends, 'count', 'Lead Trends');
            }
            
            // Revenue Trends Chart
            renderCustomChart('revenue-trends-chart', analytics.revenue_trends, 'value', 'Revenue Trends');
            
            // Status Distribution Chart
            const statusData = Object.entries(analytics.status_distribution || {}).map(([status, count]) => ({
                name: status,
                value: count
            }));
            renderCustomChart('status-distribution-chart', statusData, 'value', 'Status Distribution');
            
            // Source Performance Chart
            renderCustomChart('source-performance-chart', analytics.source_performance || [], 'conversion_rate', 'Source Performance');
        } catch (error) {
            console.error('Error rendering charts:', error);
        }
    }
    
    function renderCustomChart(containerId, data, valueKey, title) {
        const container = document.getElementById(containerId);
        if (!container || !data || data.length === 0) {
            if (container) container.innerHTML = '<div class="rax-lms-empty" style="padding: 40px; text-align: center; color: var(--rax-gray-500);">No data available</div>';
            return;
        }
        
        const maxValue = Math.max(...data.map(d => d[valueKey] || 0));
        const chartHeight = 280;
        const containerWidth = container.offsetWidth || 500;
        const barWidth = Math.max(20, (containerWidth - 60) / data.length - 8);
        
        let chartHTML = `<div style="padding: 20px 24px; position: relative; height: ${chartHeight + 50}px;">`;
        
        // Y-axis labels
        const yAxisSteps = 5;
        for (let i = 0; i <= yAxisSteps; i++) {
            const value = Math.round((maxValue / yAxisSteps) * (yAxisSteps - i));
            const yPos = (chartHeight / yAxisSteps) * i;
            chartHTML += `
                <div style="position: absolute; left: 0; top: ${yPos + 20}px; font-size: 11px; color: var(--rax-gray-500); transform: translateY(-50%);">
                    ${formatNumber(value)}
                </div>
            `;
        }
        
        // Chart bars
        chartHTML += `<div style="margin-left: 50px; position: relative; height: ${chartHeight}px;">`;
        
        if (Array.isArray(data) && data[0] && data[0].date) {
            // Line/Bar chart for trends
            data.forEach((item, index) => {
                const height = maxValue > 0 ? (item[valueKey] / maxValue) * chartHeight : 0;
                const x = (index * (barWidth + 8));
                chartHTML += `
                    <div style="position: absolute; left: ${x}px; bottom: 0; width: ${barWidth}px; display: flex; flex-direction: column; align-items: center;">
                        <div style="width: 100%; height: ${height}px; background: linear-gradient(180deg, var(--rax-primary), var(--rax-secondary)); border-radius: 6px 6px 0 0; transition: all 0.3s ease; cursor: pointer;" 
                             onmouseover="this.style.opacity='0.8'" 
                             onmouseout="this.style.opacity='1'"
                             title="${item[valueKey]}"></div>
                        <div style="text-align: center; font-size: 11px; margin-top: 8px; color: var(--rax-gray-600); font-weight: 500;">
                            ${item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : item.name}
                        </div>
                    </div>
                `;
            });
        } else {
            // Bar chart for distribution/performance
            data.forEach((item, index) => {
                const height = maxValue > 0 ? ((item[valueKey] || 0) / maxValue) * chartHeight : 0;
                const x = (index * (barWidth + 8));
                const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
                const displayName = item.name || item.source || '';
                chartHTML += `
                    <div style="position: absolute; left: ${x}px; bottom: 0; width: ${barWidth}px; display: flex; flex-direction: column; align-items: center;">
                        <div style="width: 100%; height: ${height}px; background: ${colors[index % colors.length]}; border-radius: 6px 6px 0 0; transition: all 0.3s ease; cursor: pointer;" 
                             onmouseover="this.style.opacity='0.8'" 
                             onmouseout="this.style.opacity='1'"
                             title="${item[valueKey]}"></div>
                        <div style="text-align: center; font-size: 11px; margin-top: 8px; color: var(--rax-gray-600); font-weight: 500; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${displayName.length > 12 ? displayName.substring(0, 10) + '...' : displayName}
                        </div>
                        <div style="text-align: center; font-size: 10px; margin-top: 2px; color: var(--rax-gray-500);">${item[valueKey]}</div>
                    </div>
                `;
            });
        }
        
        chartHTML += `</div></div>`;
        container.innerHTML = chartHTML;
        container.style.position = 'relative';
    }
    
    function getSortIcon(field) {
        if (sortConfig.orderby !== field) {
            return '<span style="opacity: 0.3;">↕</span>';
        }
        return sortConfig.order === 'ASC' ? '↑' : '↓';
    }
    
    function showScheduleModal(leadId) {
        const modal = `
            <div class="rax-lms-modal-overlay" id="schedule-modal">
                <div class="rax-lms-modal">
                    <div class="rax-lms-modal-header">
                        <h2 class="rax-lms-modal-title">Schedule Follow-up</h2>
                        <button class="rax-lms-modal-close" onclick="this.closest('.rax-lms-modal-overlay').remove()">×</button>
                    </div>
                    <form id="schedule-form">
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Date & Time</label>
                            <input type="datetime-local" class="rax-lms-form-input" name="datetime" required>
                        </div>
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Notes</label>
                            <textarea class="rax-lms-notes-textarea" name="notes" placeholder="Add notes about this follow-up..."></textarea>
                        </div>
                        <div class="rax-lms-modal-actions">
                            <button type="button" class="rax-lms-btn rax-lms-btn-secondary" onclick="this.closest('.rax-lms-modal-overlay').remove()">Cancel</button>
                            <button type="submit" class="rax-lms-btn rax-lms-btn-primary">Schedule</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);
        
        document.getElementById('schedule-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            try {
                await api.post(`leads/${leadId}/activities`, {
                    type: 'note',
                    content: `Follow-up scheduled for ${formData.get('datetime')}. Notes: ${formData.get('notes') || 'None'}`
                });
                showNotification('Follow-up scheduled successfully', 'success');
                document.getElementById('schedule-modal')?.remove();
                renderApp();
            } catch (error) {
                // Error handled in API
            }
        });
    }
    
    async function showEditLeadModal(leadId) {
        try {
            const lead = await api.get(`leads/${leadId}`);
            const users = raxLMS.users || [];
            
            const modal = `
                <div class="rax-lms-modal-overlay" id="edit-lead-modal">
                    <div class="rax-lms-modal">
                        <div class="rax-lms-modal-header">
                            <h2 class="rax-lms-modal-title">Edit Lead</h2>
                            <button class="rax-lms-modal-close" onclick="this.closest('.rax-lms-modal-overlay').remove()">×</button>
                        </div>
                        <form id="edit-lead-form">
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Name *</label>
                                <input type="text" class="rax-lms-form-input" name="name" value="${escapeHtml(lead.name)}" required>
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Email *</label>
                                <input type="email" class="rax-lms-form-input" name="email" value="${escapeHtml(lead.email)}" required>
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Phone</label>
                                <input type="tel" class="rax-lms-form-input" name="phone" value="${escapeHtml(lead.phone || '')}">
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Status</label>
                                <select class="rax-lms-form-input" name="status">
                                    <option value="new" ${lead.status === 'new' ? 'selected' : ''}>New</option>
                                    <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                                    <option value="qualified" ${lead.status === 'qualified' ? 'selected' : ''}>Qualified</option>
                                    <option value="converted" ${lead.status === 'converted' ? 'selected' : ''}>Converted</option>
                                    <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Lost</option>
                                </select>
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Priority</label>
                                <select class="rax-lms-form-input" name="priority">
                                    <option value="low" ${lead.priority === 'low' ? 'selected' : ''}>Low</option>
                                    <option value="medium" ${lead.priority === 'medium' ? 'selected' : ''}>Medium</option>
                                    <option value="high" ${lead.priority === 'high' ? 'selected' : ''}>High</option>
                                </select>
                            </div>
                            <div class="rax-lms-form-group">
                                <label class="rax-lms-form-label">Assigned To</label>
                                <select class="rax-lms-form-input" name="assigned_user">
                                    <option value="">Unassigned</option>
                                    ${users.map(user => `
                                        <option value="${user.id}" ${lead.assigned_user == user.id ? 'selected' : ''}>
                                            ${escapeHtml(user.name)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="rax-lms-modal-actions">
                                <button type="button" class="rax-lms-btn rax-lms-btn-secondary" onclick="this.closest('.rax-lms-modal-overlay').remove()">Cancel</button>
                                <button type="submit" class="rax-lms-btn rax-lms-btn-primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modal);
            
            document.getElementById('edit-lead-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                try {
                    await api.put(`leads/${leadId}`, data);
                    showNotification('Lead updated successfully', 'success');
                    document.getElementById('edit-lead-modal')?.remove();
                    renderApp();
                } catch (error) {
                    // Error handled in API
                }
            });
        } catch (error) {
            showNotification('Error loading lead data', 'error');
        }
    }
    
    function attachModalListeners() {
        const overlay = document.getElementById('add-lead-drawer-overlay');
        const drawer = document.getElementById('add-lead-drawer');
        if (!overlay || !drawer) return;
        
        const closeDrawer = () => {
            drawer.classList.remove('rax-lms-drawer-open');
            overlay.classList.remove('rax-lms-drawer-overlay-visible');
            // Remove from DOM after animation
            setTimeout(() => {
                overlay.remove();
            }, 300);
        };
        
        document.getElementById('close-drawer')?.addEventListener('click', closeDrawer);
        document.getElementById('cancel-add-lead')?.addEventListener('click', closeDrawer);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDrawer();
            }
        });
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeDrawer();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        document.getElementById('add-lead-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            try {
                await api.post('leads', data);
                showNotification('Lead added successfully', 'success');
                closeDrawer();
                if (currentView === 'leads') {
                    renderApp();
                }
            } catch (error) {
                // Error handled in API
            }
        });
    }
    
    // Utility functions
    function formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }
    
    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    function formatSourceName(source) {
        return source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    function getUserName(userId) {
        const users = raxLMS.users || [];
        const user = users.find(u => u.id == userId);
        return user ? user.name : 'Unknown';
    }
    
    function getUserAvatar(userId) {
        const users = raxLMS.users || [];
        const user = users.find(u => u.id == userId);
        return user && user.avatar ? user.avatar : '';
    }
    
    function getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    
    function renderAvatar(name, userId = null, size = 32) {
        let avatarUrl = '';
        if (userId) {
            avatarUrl = getUserAvatar(userId);
        }
        
        if (avatarUrl) {
            return `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" class="rax-lms-avatar" style="width: ${size}px; height: ${size}px;">`;
        } else {
            const initials = getInitials(name);
            const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
            const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;
            return `<div class="rax-lms-avatar rax-lms-avatar-initials" style="width: ${size}px; height: ${size}px; background-color: ${colors[colorIndex]};" title="${escapeHtml(name)}">${initials}</div>`;
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Analytics Page
    async function renderAnalytics() {
        try {
            const analytics = await api.get('analytics');
            
            // Calculate trends (mock data - can be replaced with actual comparison)
            const trends = {
                avg_lead_value: { value: 5, positive: true },
                total_pipeline: { value: 12, positive: true },
                conversion_rate: { value: 3, positive: true },
                time_to_close: { value: 8, positive: false }
            };
            
            const formatValue = (value) => {
                if (value >= 1000) {
                    return (value / 1000).toFixed(1) + 'k';
                }
                return formatNumber(value);
            };
            
            return `
                <div class="rax-lms-analytics-page">
                    <div class="rax-lms-analytics-header">
                        <div>
                            <h2 class="rax-lms-analytics-title">Analytics Overview</h2>
                            <p class="rax-lms-analytics-subtitle">Track your lead performance and conversion metrics</p>
                        </div>
                    </div>
                    
                    <div class="rax-lms-analytics-section">
                        <div class="rax-lms-kpi-grid">
                            <div class="rax-lms-kpi-card">
                                <div class="rax-lms-kpi-header">
                                    <div class="rax-lms-kpi-icon">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </div>
                                    <div class="rax-lms-kpi-content">
                                        <div class="rax-lms-kpi-label">Avg Lead Value</div>
                                        <div class="rax-lms-kpi-value">$${formatValue(analytics.avg_lead_value || 0)}</div>
                                        <div class="rax-lms-kpi-trend ${trends.avg_lead_value.positive ? 'positive' : 'negative'}">
                                            <span class="rax-lms-kpi-trend-arrow">${trends.avg_lead_value.positive ? '↑' : '↓'}</span>
                                            <span>${trends.avg_lead_value.value}% vs last month</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="rax-lms-kpi-card">
                                <div class="rax-lms-kpi-header">
                                    <div class="rax-lms-kpi-icon">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </div>
                                    <div class="rax-lms-kpi-content">
                                        <div class="rax-lms-kpi-label">Total Pipeline</div>
                                        <div class="rax-lms-kpi-value">$${formatValue(analytics.total_pipeline || 0)}</div>
                                        <div class="rax-lms-kpi-trend ${trends.total_pipeline.positive ? 'positive' : 'negative'}">
                                            <span class="rax-lms-kpi-trend-arrow">${trends.total_pipeline.positive ? '↑' : '↓'}</span>
                                            <span>${trends.total_pipeline.value}% vs last month</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="rax-lms-kpi-card">
                                <div class="rax-lms-kpi-header">
                                    <div class="rax-lms-kpi-icon">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </div>
                                    <div class="rax-lms-kpi-content">
                                        <div class="rax-lms-kpi-label">Conversion Rate</div>
                                        <div class="rax-lms-kpi-value">${analytics.conversion_rate || 0}%</div>
                                        <div class="rax-lms-kpi-trend ${trends.conversion_rate.positive ? 'positive' : 'negative'}">
                                            <span class="rax-lms-kpi-trend-arrow">${trends.conversion_rate.positive ? '↑' : '↓'}</span>
                                            <span>${trends.conversion_rate.value}% vs last month</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="rax-lms-kpi-card">
                                <div class="rax-lms-kpi-header">
                                    <div class="rax-lms-kpi-icon">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </div>
                                    <div class="rax-lms-kpi-content">
                                        <div class="rax-lms-kpi-label">Time to Close</div>
                                        <div class="rax-lms-kpi-value">${analytics.time_to_close || 0} days</div>
                                        <div class="rax-lms-kpi-trend ${trends.time_to_close.positive ? 'positive' : 'negative'}">
                                            <span class="rax-lms-kpi-trend-arrow">${trends.time_to_close.positive ? '↑' : '↓'}</span>
                                            <span>${trends.time_to_close.value}% vs last month</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="rax-lms-analytics-section">
                        <div class="rax-lms-analytics-section-header">
                            <h3 class="rax-lms-analytics-section-title">Performance Trends</h3>
                        </div>
                        <div class="rax-lms-charts-grid">
                            <div class="rax-lms-chart-card">
                                <div class="rax-lms-chart-title">Lead Trends</div>
                                <div class="rax-lms-chart-subtitle">Last 30 days</div>
                                <div id="lead-trends-chart" class="rax-lms-chart-wrapper"></div>
                            </div>
                            <div class="rax-lms-chart-card">
                                <div class="rax-lms-chart-title">Revenue Trends</div>
                                <div class="rax-lms-chart-subtitle">Last 30 days</div>
                                <div id="revenue-trends-chart" class="rax-lms-chart-wrapper"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="rax-lms-analytics-section">
                        <div class="rax-lms-analytics-section-header">
                            <h3 class="rax-lms-analytics-section-title">Distribution Analysis</h3>
                        </div>
                        <div class="rax-lms-charts-grid">
                            <div class="rax-lms-chart-card">
                                <div class="rax-lms-chart-title">Status Distribution</div>
                                <div class="rax-lms-chart-subtitle">Lead status breakdown</div>
                                <div id="status-distribution-chart" class="rax-lms-chart-wrapper"></div>
                            </div>
                            <div class="rax-lms-chart-card">
                                <div class="rax-lms-chart-title">Source Performance</div>
                                <div class="rax-lms-chart-subtitle">Conversion by source</div>
                                <div id="source-performance-chart" class="rax-lms-chart-wrapper"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading analytics: ${error.message}</div>`;
        }
    }
    
    // Helper function to parse criteria into tags
    function parseCriteriaToTags(criteria) {
        const tags = [];
        
        // Parse common patterns
        if (criteria.includes('priority = "high"')) {
            tags.push('Priority: High');
        }
        if (criteria.includes('priority = "medium"')) {
            tags.push('Priority: Medium');
        }
        if (criteria.includes('priority = "low"')) {
            tags.push('Priority: Low');
        }
        if (criteria.includes('priority IN ("high", "medium")')) {
            tags.push('Priority: High or Medium');
        }
        
        if (criteria.includes('status = "qualified"')) {
            tags.push('Status: Qualified');
        }
        if (criteria.includes('status = "contacted"')) {
            tags.push('Status: Contacted');
        }
        if (criteria.includes('status = "new"')) {
            tags.push('Status: New');
        }
        
        if (criteria.includes('7 DAY')) {
            tags.push('Last 7 days');
        }
        if (criteria.includes('30 DAY')) {
            tags.push('Last 30 days');
        }
        
        if (criteria.includes('assigned_user IS NULL')) {
            tags.push('Unassigned');
        }
        
        if (criteria.includes('source LIKE "%enterprise%"')) {
            tags.push('Source: Enterprise');
        }
        if (criteria.includes('source LIKE "%fluent%"')) {
            tags.push('Source: Fluent Forms');
        }
        
        // If no tags found, return the criteria as a single tag
        if (tags.length === 0) {
            tags.push(criteria);
        }
        
        return tags;
    }
    
    // Segments Page
    async function renderSegments() {
        try {
            const data = await api.get('segments');
            segmentsData.all = data.segments || [];
            
            // Find most active segment (highest count)
            const mostActiveSegment = segmentsData.all.length > 0 
                ? segmentsData.all.reduce((max, seg) => seg.count > max.count ? seg : max, segmentsData.all[0])
                : null;
            
            const totalLeads = data.segments.reduce((sum, s) => sum + s.count, 0);
            const avgSize = Math.round(data.avg_segment_size || 0);
            
            return `
                <div class="rax-lms-segments-page">
                    <div class="rax-lms-segments-header">
                        <div>
                            <h2 class="rax-lms-segments-title">Lead Segments</h2>
                            <p class="rax-lms-segments-subtitle">Create and manage filtered groups of leads for targeted actions</p>
                        </div>
                        <button class="rax-lms-btn rax-lms-btn-secondary" id="create-segment-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            Create Segment
                        </button>
                    </div>
                    
                    <div class="rax-lms-segments-stats">
                        <div class="rax-lms-segments-stat-card">
                            <div class="rax-lms-segments-stat-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <div class="rax-lms-segments-stat-content">
                                <div class="rax-lms-segments-stat-label">Total Segments</div>
                                <div class="rax-lms-segments-stat-value">${data.total_segments || 0}</div>
                            </div>
                        </div>
                        <div class="rax-lms-segments-stat-card">
                            <div class="rax-lms-segments-stat-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <div class="rax-lms-segments-stat-content">
                                <div class="rax-lms-segments-stat-label">Most Active</div>
                                <div class="rax-lms-segments-stat-value">${mostActiveSegment ? escapeHtml(mostActiveSegment.name) : 'N/A'}</div>
                            </div>
                        </div>
                        <div class="rax-lms-segments-stat-card">
                            <div class="rax-lms-segments-stat-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <div class="rax-lms-segments-stat-content">
                                <div class="rax-lms-segments-stat-label">Avg Segment Size</div>
                                <div class="rax-lms-segments-stat-value">${avgSize} leads</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="rax-lms-segments-grid">
                        ${segmentsData.all.length > 0 ? segmentsData.all.map(segment => {
                            const criteriaTags = parseCriteriaToTags(segment.criteria);
                            return `
                                <div class="rax-lms-segment-card">
                                    <div class="rax-lms-segment-header">
                                        <div class="rax-lms-segment-info">
                                            <h3 class="rax-lms-segment-name">${escapeHtml(segment.name)}</h3>
                                            <p class="rax-lms-segment-description">${escapeHtml(segment.description)}</p>
                                        </div>
                                    </div>
                                    <div class="rax-lms-segment-criteria">
                                        <div class="rax-lms-segment-criteria-label">Criteria:</div>
                                        <div class="rax-lms-segment-criteria-tags">
                                            ${criteriaTags.map(tag => `
                                                <span class="rax-lms-segment-criteria-tag">${escapeHtml(tag)}</span>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <div class="rax-lms-segment-footer">
                                        <div class="rax-lms-segment-count">${segment.count} ${segment.count === 1 ? 'lead' : 'leads'}</div>
                                        <button class="rax-lms-btn rax-lms-btn-secondary rax-lms-segment-view-btn" 
                                                onclick="window.raxLMSViewSegment(${segment.id})">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                            View Leads
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('') : `
                            <div class="rax-lms-empty-segments">
                                <div class="rax-lms-empty-icon">📋</div>
                                <div class="rax-lms-empty-text">No segments available</div>
                            </div>
                        `}
                    </div>
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading segments: ${error.message}</div>`;
        }
    }
    
    // Tags Page
    async function renderTags() {
        try {
            const data = await api.get('tags');
            
            return `
                <div>
                    <div class="rax-lms-kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
                        <div class="rax-lms-kpi-card">
                            <div class="rax-lms-kpi-label">Total Tags</div>
                            <div class="rax-lms-kpi-value">${data.total_tags || 0}</div>
                        </div>
                        <div class="rax-lms-kpi-card">
                            <div class="rax-lms-kpi-label">Most Used Tag</div>
                            <div class="rax-lms-kpi-value" style="font-size: 18px;">${escapeHtml(data.most_used || 'N/A')}</div>
                        </div>
                        <div class="rax-lms-kpi-card">
                            <div class="rax-lms-kpi-label">Avg Tags per Lead</div>
                            <div class="rax-lms-kpi-value">${data.avg_tags_per_lead || 0}</div>
                        </div>
                    </div>
                    <div class="rax-lms-table-container" style="margin-top: 24px;">
                        <div class="rax-lms-table-header">
                            <div class="rax-lms-table-title">All Tags</div>
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <input type="text" class="rax-lms-filter-input" id="tag-search" 
                                       placeholder="Search tags..." style="width: 250px;">
                                <button class="rax-lms-btn rax-lms-btn-primary" id="create-tag-btn">+ Create Tag</button>
                            </div>
                        </div>
                        <table class="rax-lms-table">
                            <thead>
                                <tr>
                                    <th>Tag Name</th>
                                    <th>Usage Count</th>
                                    <th>Usage %</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="tags-table-body">
                                ${data.tags.map(tag => `
                                    <tr data-tag-name="${escapeHtml(tag.name)}">
                                        <td><span class="rax-lms-tag">${escapeHtml(tag.name)}</span></td>
                                        <td>${tag.count}</td>
                                        <td>${tag.usage_percentage}%</td>
                                        <td>
                                            <button class="rax-lms-btn rax-lms-btn-sm rax-lms-btn-secondary edit-tag" 
                                                    data-tag="${escapeHtml(tag.name)}">Edit</button>
                                            <button class="rax-lms-btn rax-lms-btn-sm rax-lms-btn-danger delete-tag" 
                                                    data-tag="${escapeHtml(tag.name)}">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading tags: ${error.message}</div>`;
        }
    }
    
    // Calendar Page
    async function renderCalendar() {
        const now = new Date();
        const currentMonth = calendarState.month;
        const currentYear = calendarState.year;
        
        try {
            const data = await api.get(`calendar?month=${currentMonth}&year=${currentYear}`);
            
            const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
            const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
            const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });
            
            // Group events by date
            const eventsByDate = {};
            data.events.forEach(event => {
                if (!eventsByDate[event.date]) {
                    eventsByDate[event.date] = [];
                }
                eventsByDate[event.date].push(event);
            });
            
            // Generate calendar grid
            let calendarHTML = '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--rax-gray-200);">';
            
            // Day headers
            const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            dayHeaders.forEach(day => {
                calendarHTML += `<div style="background: white; padding: 12px; text-align: center; font-weight: 600; font-size: 12px; color: var(--rax-gray-700);">${day}</div>`;
            });
            
            // Empty cells for days before month starts
            for (let i = 0; i < firstDay; i++) {
                calendarHTML += '<div style="background: white; min-height: 100px;"></div>';
            }
            
            // Days of the month
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = eventsByDate[dateStr] || [];
                const isToday = currentYear === now.getFullYear() && 
                               currentMonth === now.getMonth() + 1 && 
                               day === now.getDate();
                
                calendarHTML += `
                    <div style="background: white; min-height: 100px; padding: 8px; ${isToday ? 'border: 2px solid var(--rax-primary);' : ''}">
                        <div style="font-weight: 600; margin-bottom: 4px; ${isToday ? 'color: var(--rax-primary);' : ''}">${day}</div>
                        ${dayEvents.slice(0, 2).map(event => `
                            <div style="font-size: 10px; padding: 2px 4px; background: var(--rax-primary); color: white; border-radius: 3px; margin-bottom: 2px; cursor: pointer;" 
                                 onclick="window.raxLMSViewLead(${event.lead_id})" title="${escapeHtml(event.lead_name)}">
                                ${escapeHtml(event.lead_name.substring(0, 15))}${event.lead_name.length > 15 ? '...' : ''}
                            </div>
                        `).join('')}
                        ${dayEvents.length > 2 ? `<div style="font-size: 10px; color: var(--rax-gray-500);">+${dayEvents.length - 2} more</div>` : ''}
                    </div>
                `;
            }
            
            calendarHTML += '</div>';
            
            // Upcoming follow-ups
            const upcomingEvents = data.events
                .filter(e => e.type === 'followup')
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 10);
            
            return `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h2 style="margin: 0;">${monthName} ${currentYear}</h2>
                        <div style="display: flex; gap: 8px;">
                            <button class="rax-lms-btn rax-lms-btn-secondary" id="prev-month">← Previous</button>
                            <button class="rax-lms-btn rax-lms-btn-secondary" id="next-month">Next →</button>
                        </div>
                    </div>
                    ${calendarHTML}
                    <div class="rax-lms-details-card" style="margin-top: 24px;">
                        <div class="rax-lms-details-card-title">Upcoming Follow-ups</div>
                        ${upcomingEvents.length > 0 ? `
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${upcomingEvents.map(event => `
                                    <div style="padding: 12px; background: var(--rax-gray-50); border-radius: 6px; cursor: pointer;" 
                                         onclick="window.raxLMSViewLead(${event.lead_id})">
                                        <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(event.lead_name)}</div>
                                        <div style="font-size: 12px; color: var(--rax-gray-600);">${formatDate(event.date)}</div>
                                        <div style="font-size: 12px; color: var(--rax-gray-500); margin-top: 4px;">${escapeHtml(event.content.substring(0, 100))}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div class="rax-lms-empty">No upcoming follow-ups</div>'}
                    </div>
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading calendar: ${error.message}</div>`;
        }
    }
    
    // Report Page
    async function renderReport() {
        try {
            // Helper function to format date as YYYY-MM-DD
            const formatDateForAPI = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            // Helper function to format date for display (DD/MM/YYYY)
            const formatDateForDisplay = (date) => {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            };
            
            // Initialize date range (default: last 30 days)
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            const dateFrom = formatDateForAPI(thirtyDaysAgo);
            const dateTo = formatDateForAPI(today);
            const dateFromDisplay = formatDateForDisplay(thirtyDaysAgo);
            const dateToDisplay = formatDateForDisplay(today);
            
            // Fetch report data
            const reportData = await api.get(`reports/overview?date_from=${dateFrom}&date_to=${dateTo}`);
            
            // Calculate trends (mock for now - can be enhanced with actual comparison data)
            const trends = {
                total_leads: { value: 12, positive: true },
                conversions: { value: 5, positive: true },
                active_leads: { value: 8, positive: true },
                revenue: { value: 8, positive: true }
            };
            
            const formatValue = (value) => {
                if (value >= 1000) {
                    return (value / 1000).toFixed(1) + 'k';
                }
                return formatNumber(value);
            };
            
            const reportTypes = [
                { id: 'overview', title: 'Overview Report', desc: 'High-level summary of all lead data' },
                { id: 'performance', title: 'Performance Report', desc: 'Metrics, trends, and conversion insights' },
                { id: 'source-analysis', title: 'Source Analysis', desc: 'Detailed breakdown by lead source' },
                { id: 'conversion', title: 'Conversion Report', desc: 'Visual funnel and conversion trends' },
                { id: 'activity', title: 'Activity Report', desc: 'Team activity and engagement metrics' }
            ];
            
            return `
                <div class="rax-lms-report-page">
                    <div class="rax-lms-report-types">
                        ${reportTypes.map(type => `
                            <div class="rax-lms-report-type-card ${type.id === 'overview' ? 'active' : ''}" data-report-type="${type.id}">
                                <div class="rax-lms-report-type-title">${escapeHtml(type.title)}</div>
                                <div class="rax-lms-report-type-desc">${escapeHtml(type.desc)}</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="rax-lms-report-main">
                        <div class="rax-lms-report-header">
                            <h2 class="rax-lms-report-title">Overview Report</h2>
                            <div class="rax-lms-report-controls">
                                <div class="rax-lms-report-date-buttons">
                                    <button class="rax-lms-report-date-btn" data-days="7">7 Days</button>
                                    <button class="rax-lms-report-date-btn active" data-days="30">30 Days</button>
                                    <button class="rax-lms-report-date-btn" data-days="90">3 Months</button>
                                    <button class="rax-lms-report-date-btn" data-days="180">6 Months</button>
                                    <button class="rax-lms-report-date-btn" data-days="365">1 Year</button>
                                </div>
                                <div class="rax-lms-report-custom-dates">
                                    <input type="date" class="rax-lms-report-date-input" id="report-date-from" value="${dateFrom}">
                                    <span class="rax-lms-report-date-separator">to</span>
                                    <input type="date" class="rax-lms-report-date-input" id="report-date-to" value="${dateTo}">
                                </div>
                                <div class="rax-lms-report-export">
                                    <button class="rax-lms-btn rax-lms-btn-secondary" id="export-report">
                                        Export
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <polyline points="6 9 12 15 18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="rax-lms-report-kpis">
                            <div class="rax-lms-report-kpi-card">
                                <div class="rax-lms-report-kpi-label">Total Leads</div>
                                <div class="rax-lms-report-kpi-value">${formatNumber(reportData.total_leads || 0)}</div>
                                <div class="rax-lms-report-kpi-trend ${trends.total_leads.positive ? 'positive' : 'negative'}">
                                    <span class="rax-lms-report-kpi-arrow">${trends.total_leads.positive ? '↑' : '↓'}</span>
                                    <span>${trends.total_leads.value}% vs last month</span>
                                </div>
                            </div>
                            <div class="rax-lms-report-kpi-card">
                                <div class="rax-lms-report-kpi-label">Conversions</div>
                                <div class="rax-lms-report-kpi-value">${reportData.conversions || 0}</div>
                                <div class="rax-lms-report-kpi-trend ${trends.conversions.positive ? 'positive' : 'negative'}">
                                    <span class="rax-lms-report-kpi-arrow">${trends.conversions.positive ? '↑' : '↓'}</span>
                                    <span>${trends.conversions.value}% vs last month</span>
                                </div>
                            </div>
                            <div class="rax-lms-report-kpi-card">
                                <div class="rax-lms-report-kpi-label">Active Leads</div>
                                <div class="rax-lms-report-kpi-value">${reportData.active_leads || 0}</div>
                                <div class="rax-lms-report-kpi-trend ${trends.active_leads.positive ? 'positive' : 'negative'}">
                                    <span class="rax-lms-report-kpi-arrow">${trends.active_leads.positive ? '↑' : '↓'}</span>
                                    <span>${trends.active_leads.value}% vs last month</span>
                                </div>
                            </div>
                            <div class="rax-lms-report-kpi-card">
                                <div class="rax-lms-report-kpi-label">Revenue</div>
                                <div class="rax-lms-report-kpi-value">$${formatNumber(reportData.revenue || 0)}</div>
                                <div class="rax-lms-report-kpi-trend ${trends.revenue.positive ? 'positive' : 'negative'}">
                                    <span class="rax-lms-report-kpi-arrow">${trends.revenue.positive ? '↑' : '↓'}</span>
                                    <span>${trends.revenue.value}% vs last month</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="rax-lms-report-chart-section">
                            <div class="rax-lms-report-chart-header">
                                <div>
                                    <h3 class="rax-lms-report-chart-title">Monthly Performance</h3>
                                    <p class="rax-lms-report-chart-subtitle">Lead acquisition over the selected period</p>
                                </div>
                            </div>
                            <div class="rax-lms-report-chart-container">
                                <div id="report-monthly-chart" class="rax-lms-report-chart"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading report: ${error.message}</div>`;
        }
    }
    
    // Settings Page
    async function renderSettings() {
        try {
            const settings = await api.get('settings');
            
            return `
                <div style="max-width: 800px;">
                    <div class="rax-lms-details-card">
                        <div class="rax-lms-details-card-title">Profile Settings</div>
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Name</label>
                            <input type="text" class="rax-lms-form-input" id="profile-name" 
                                   value="${escapeHtml(settings.profile.name)}">
                        </div>
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Email</label>
                            <input type="email" class="rax-lms-form-input" id="profile-email" 
                                   value="${escapeHtml(settings.profile.email)}">
                        </div>
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Role</label>
                            <input type="text" class="rax-lms-form-input" id="profile-role" 
                                   value="${escapeHtml(settings.profile.role)}" readonly>
                        </div>
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Timezone</label>
                            <select class="rax-lms-form-input" id="profile-timezone">
                                <option value="${settings.profile.timezone}" selected>${settings.profile.timezone}</option>
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">America/New_York</option>
                                <option value="America/Los_Angeles">America/Los_Angeles</option>
                                <option value="Europe/London">Europe/London</option>
                                <option value="Asia/Tokyo">Asia/Tokyo</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="rax-lms-details-card" style="margin-top: 24px;">
                        <div class="rax-lms-details-card-title">Lead Preferences</div>
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Default Status</label>
                            <select class="rax-lms-form-input" id="default-status">
                                <option value="new" ${settings.lead_preferences.default_status === 'new' ? 'selected' : ''}>New</option>
                                <option value="contacted" ${settings.lead_preferences.default_status === 'contacted' ? 'selected' : ''}>Contacted</option>
                                <option value="qualified" ${settings.lead_preferences.default_status === 'qualified' ? 'selected' : ''}>Qualified</option>
                            </select>
                        </div>
                        <div class="rax-lms-form-group">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="auto-assignment" 
                                       ${settings.lead_preferences.auto_assignment ? 'checked' : ''} 
                                       style="width: 18px; height: 18px;">
                                <span>Auto-assign leads to current user</span>
                            </label>
                        </div>
                        <div class="rax-lms-form-group">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="lead-scoring" 
                                       ${settings.lead_preferences.lead_scoring ? 'checked' : ''} 
                                       style="width: 18px; height: 18px;">
                                <span>Enable lead scoring</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="rax-lms-details-card" style="margin-top: 24px;">
                        <div class="rax-lms-details-card-title">Features</div>
                        <div class="rax-lms-form-group">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="duplicate-detection" 
                                       ${settings.features.duplicate_detection ? 'checked' : ''} 
                                       style="width: 18px; height: 18px;">
                                <span>Duplicate detection</span>
                            </label>
                        </div>
                        <div class="rax-lms-form-group">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="email-notifications" 
                                       ${settings.features.email_notifications ? 'checked' : ''} 
                                       style="width: 18px; height: 18px;">
                                <span>Email notifications</span>
                            </label>
                        </div>
                        <div class="rax-lms-form-group">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="activity-logging" 
                                       ${settings.features.activity_logging ? 'checked' : ''} 
                                       style="width: 18px; height: 18px;">
                                <span>Activity logging</span>
                            </label>
                        </div>
                    </div>
                    
                    <div style="margin-top: 24px;">
                        <button class="rax-lms-btn rax-lms-btn-primary" id="save-settings">Save Settings</button>
                    </div>
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading settings: ${error.message}</div>`;
        }
    }
    
    // Global functions for onclick handlers
    window.raxLMSViewSegment = async function(segmentId) {
        try {
            const data = await api.get(`segments/${segmentId}`);
            currentView = 'leads';
            filters = {};
            // Store segment leads in a way that can be filtered
            renderApp();
            showNotification(`Showing ${data.total} leads from segment`, 'success');
        } catch (error) {
            showNotification('Error loading segment leads', 'error');
        }
    };
    
    window.raxLMSViewLead = function(leadId) {
        currentLeadId = leadId;
        currentView = 'lead-details';
        renderApp();
    };
    
    // Create Tag Modal
    function showCreateTagModal() {
        const modal = `
            <div class="rax-lms-modal-overlay" id="create-tag-modal">
                <div class="rax-lms-modal">
                    <div class="rax-lms-modal-header">
                        <h2 class="rax-lms-modal-title">Create New Tag</h2>
                        <button class="rax-lms-modal-close" onclick="this.closest('.rax-lms-modal-overlay').remove()">×</button>
                    </div>
                    <form id="create-tag-form">
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Tag Name *</label>
                            <input type="text" class="rax-lms-form-input" name="name" 
                                   placeholder="e.g., VIP, Enterprise, Hot Lead" required 
                                   pattern="[A-Za-z0-9\s_-]+" 
                                   title="Tag name can only contain letters, numbers, spaces, hyphens, and underscores"
                                   maxlength="50">
                            <div style="font-size: 12px; color: var(--rax-gray-500); margin-top: 4px;">
                                Use letters, numbers, spaces, hyphens, or underscores. Max 50 characters.
                            </div>
                        </div>
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Description (Optional)</label>
                            <textarea class="rax-lms-notes-textarea" name="description" 
                                      placeholder="Add a description for this tag..." 
                                      rows="3" maxlength="200"></textarea>
                        </div>
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Color (Optional)</label>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                ${['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'].map(color => `
                                    <label style="cursor: pointer;">
                                        <input type="radio" name="color" value="${color}" style="display: none;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${color}; border: 2px solid transparent; transition: all 0.2s;" 
                                             onmouseover="this.style.borderColor='var(--rax-gray-400)'" 
                                             onmouseout="this.style.borderColor='transparent'"
                                             onclick="this.previousElementSibling.checked=true; this.style.borderColor='var(--rax-primary)'; this.style.borderWidth='3px';">
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <div class="rax-lms-modal-actions">
                            <button type="button" class="rax-lms-btn rax-lms-btn-secondary" onclick="this.closest('.rax-lms-modal-overlay').remove()">Cancel</button>
                            <button type="submit" class="rax-lms-btn rax-lms-btn-primary">Create Tag</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);
        
        const modalEl = document.getElementById('create-tag-modal');
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) {
                modalEl.remove();
            }
        });
        
        document.getElementById('create-tag-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                name: formData.get('name').trim(),
                description: formData.get('description')?.trim() || '',
                color: formData.get('color') || '#6366f1'
            };
            
            if (!data.name) {
                showNotification('Tag name is required', 'error');
                return;
            }
            
            try {
                const result = await api.post('tags', data);
                showNotification(result.message || 'Tag created successfully', 'success');
                modalEl.remove();
                renderApp();
            } catch (error) {
                showNotification(error.message || 'Failed to create tag', 'error');
            }
        });
    }
    
    // Edit Tag Modal
    function showEditTagModal(tagName) {
        const modal = `
            <div class="rax-lms-modal-overlay" id="edit-tag-modal">
                <div class="rax-lms-modal">
                    <div class="rax-lms-modal-header">
                        <h2 class="rax-lms-modal-title">Edit Tag</h2>
                        <button class="rax-lms-modal-close" onclick="this.closest('.rax-lms-modal-overlay').remove()">×</button>
                    </div>
                    <form id="edit-tag-form">
                        <div class="rax-lms-form-group">
                            <label class="rax-lms-form-label">Tag Name *</label>
                            <input type="text" class="rax-lms-form-input" name="name" 
                                   value="${escapeHtml(tagName)}" required 
                                   pattern="[A-Za-z0-9\s_-]+" 
                                   title="Tag name can only contain letters, numbers, spaces, hyphens, and underscores"
                                   maxlength="50">
                            <div style="font-size: 12px; color: var(--rax-gray-500); margin-top: 4px;">
                                Use letters, numbers, spaces, hyphens, or underscores. Max 50 characters.
                            </div>
                        </div>
                        <div class="rax-lms-form-group">
                            <div style="padding: 12px; background: var(--rax-gray-50); border-radius: 6px; font-size: 12px; color: var(--rax-gray-600);">
                                <strong>Note:</strong> Changing the tag name will update it across all leads that use this tag.
                            </div>
                        </div>
                        <div class="rax-lms-modal-actions">
                            <button type="button" class="rax-lms-btn rax-lms-btn-secondary" onclick="this.closest('.rax-lms-modal-overlay').remove()">Cancel</button>
                            <button type="submit" class="rax-lms-btn rax-lms-btn-primary">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);
        
        const modalEl = document.getElementById('edit-tag-modal');
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) {
                modalEl.remove();
            }
        });
        
        document.getElementById('edit-tag-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const newName = formData.get('name').trim();
            
            if (!newName) {
                showNotification('Tag name is required', 'error');
                return;
            }
            
            if (newName === tagName) {
                modalEl.remove();
                return;
            }
            
            try {
                await api.put(`tags/${encodeURIComponent(tagName)}`, { name: newName });
                showNotification('Tag updated successfully', 'success');
                modalEl.remove();
                renderApp();
            } catch (error) {
                showNotification(error.message || 'Failed to update tag', 'error');
            }
        });
    }
    
    // Initialize app
    document.addEventListener('DOMContentLoaded', async () => {
        if (document.getElementById('rax-reports-app')) {
            initReportsPage();
        } else {
            await renderApp();
        }
    });
    
    // Reports Page Functionality
    function initReportsPage() {
        const appContainer = document.getElementById('rax-reports-app');
        if (!appContainer) return;
        
        let currentReportType = 'overview';
        let currentDateFrom = null;
        let currentDateTo = null;
        let reportCharts = {};
        
        // Initialize date range (default: last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        currentDateFrom = formatDate(thirtyDaysAgo);
        currentDateTo = formatDate(today);
        
        // Render initial UI
        renderReportsUI();
        loadReportData();
        
        function renderReportsUI() {
            const reportTypes = [
                {
                    id: 'overview',
                    title: 'Overview Report',
                    desc: 'High-level summary of all lead data'
                },
                {
                    id: 'performance',
                    title: 'Performance Report',
                    desc: 'Metrics, trends, and conversion insights'
                },
                {
                    id: 'source-analysis',
                    title: 'Source Analysis',
                    desc: 'Detailed breakdown by lead source'
                },
                {
                    id: 'conversion',
                    title: 'Conversion Report',
                    desc: 'Visual funnel and conversion trends'
                },
                {
                    id: 'activity',
                    title: 'Activity Report',
                    desc: 'Team activity and engagement metrics'
                }
            ];
            
            appContainer.innerHTML = `
                <div class="rax-reports-container">
                    <div class="rax-reports-type-selector">
                        ${reportTypes.map(type => `
                            <div class="rax-report-type-card ${type.id === currentReportType ? 'active' : ''}" 
                                 data-report-type="${type.id}">
                                <div class="rax-report-type-title">${type.title}</div>
                                <div class="rax-report-type-desc">${type.desc}</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="rax-reports-header">
                        <h2 class="rax-reports-title" id="rax-reports-title">${reportTypes.find(t => t.id === currentReportType).title}</h2>
                        <div class="rax-reports-actions">
                            <div class="rax-reports-date-filter">
                                <div class="rax-reports-date-presets">
                                    <button class="rax-reports-date-btn" data-days="7">7 Days</button>
                                    <button class="rax-reports-date-btn" data-days="30">30 Days</button>
                                    <button class="rax-reports-date-btn" data-days="90">3 Months</button>
                                    <button class="rax-reports-date-btn" data-days="180">6 Months</button>
                                    <button class="rax-reports-date-btn" data-days="365">1 Year</button>
                                </div>
                                <div class="rax-reports-custom-date">
                                    <input type="date" id="rax-date-from" value="${currentDateFrom}">
                                    <span>to</span>
                                    <input type="date" id="rax-date-to" value="${currentDateTo}">
                                </div>
                            </div>
                            <div class="rax-reports-export">
                                <button class="rax-reports-export-btn" id="rax-export-btn">
                                    Export <span class="dashicons dashicons-arrow-down-alt2"></span>
                                </button>
                                <div class="rax-reports-export-menu" id="rax-export-menu">
                                    <button class="rax-reports-export-item" data-format="pdf">Export as PDF</button>
                                    <button class="rax-reports-export-item" data-format="csv">Export as CSV</button>
                                    <button class="rax-reports-export-item" data-format="excel">Export as Excel</button>
                                    <button class="rax-reports-export-item" data-action="print">Print Report</button>
                                    <button class="rax-reports-export-item" data-action="email">Email Report</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="rax-reports-content" id="rax-reports-content">
                        <div class="rax-reports-loading">
                            <div class="rax-reports-loading-spinner"></div>
                        </div>
                    </div>
                </div>
            `;
            
            // Event listeners
            document.querySelectorAll('.rax-report-type-card').forEach(card => {
                card.addEventListener('click', () => {
                    currentReportType = card.dataset.reportType;
                    document.querySelectorAll('.rax-report-type-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    document.getElementById('rax-reports-title').textContent = reportTypes.find(t => t.id === currentReportType).title;
                    loadReportData();
                });
            });
            
            // Date preset buttons
            document.querySelectorAll('.rax-reports-date-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const days = parseInt(btn.dataset.days);
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(endDate.getDate() - days);
                    
                    currentDateFrom = formatDate(startDate);
                    currentDateTo = formatDate(endDate);
                    
                    document.getElementById('rax-date-from').value = currentDateFrom;
                    document.getElementById('rax-date-to').value = currentDateTo;
                    
                    document.querySelectorAll('.rax-reports-date-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    loadReportData();
                });
            });
            
            // Custom date inputs
            document.getElementById('rax-date-from').addEventListener('change', (e) => {
                currentDateFrom = e.target.value;
                document.querySelectorAll('.rax-reports-date-btn').forEach(b => b.classList.remove('active'));
                loadReportData();
            });
            
            document.getElementById('rax-date-to').addEventListener('change', (e) => {
                currentDateTo = e.target.value;
                document.querySelectorAll('.rax-reports-date-btn').forEach(b => b.classList.remove('active'));
                loadReportData();
            });
            
            // Export dropdown
            const exportBtn = document.getElementById('rax-export-btn');
            const exportMenu = document.getElementById('rax-export-menu');
            
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                exportMenu.classList.toggle('show');
            });
            
            document.addEventListener('click', (e) => {
                if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
                    exportMenu.classList.remove('show');
                }
            });
            
            document.querySelectorAll('.rax-reports-export-item').forEach(item => {
                item.addEventListener('click', () => {
                    const format = item.dataset.format;
                    const action = item.dataset.action;
                    
                    if (format) {
                        exportReport(format);
                    } else if (action === 'print') {
                        window.print();
                    } else if (action === 'email') {
                        alert('Email report functionality coming soon!');
                    }
                    
                    exportMenu.classList.remove('show');
                });
            });
            
            // Set default active date button
            document.querySelector('.rax-reports-date-btn[data-days="30"]').classList.add('active');
        }
        
        async function loadReportData() {
            const content = document.getElementById('rax-reports-content');
            if (!content) return;
            
            content.innerHTML = '<div class="rax-reports-loading"><div class="rax-reports-loading-spinner"></div></div>';
            
            try {
                const response = await api.get(`reports/${currentReportType}?date_from=${currentDateFrom}&date_to=${currentDateTo}`);
                const data = response;
                
                // Render report content directly
                renderReportContent(data);
            } catch (error) {
                console.error('Error loading report:', error);
                content.innerHTML = `
                    <div class="rax-reports-empty">
                        <div class="rax-reports-empty-icon">⚠️</div>
                        <div class="rax-reports-empty-text">Failed to load report data. Please try again.</div>
                    </div>
                `;
            }
        }
        
        function renderReportContent(data) {
            const content = document.getElementById('rax-reports-content');
            if (!content) return;
            
            // Destroy existing charts
            Object.values(reportCharts).forEach(chart => {
                if (chart && chart.destroy) chart.destroy();
            });
            reportCharts = {};
            
            switch (currentReportType) {
                case 'overview':
                    renderOverviewReport(data);
                    break;
                case 'performance':
                    renderPerformanceReport(data);
                    break;
                case 'source-analysis':
                    renderSourceAnalysisReport(data);
                    break;
                case 'conversion':
                    renderConversionReport(data);
                    break;
                case 'activity':
                    renderActivityReport(data);
                    break;
            }
        }
        
        function renderOverviewReport(data) {
            const content = document.getElementById('rax-reports-content');
            
            // Calculate trends (mock for now)
            const trends = {
                total_leads: { value: 12, positive: true },
                conversions: { value: 5, positive: true },
                active_leads: { value: 8, positive: true },
                revenue: { value: 8, positive: true }
            };
            
            content.innerHTML = `
                <div class="rax-reports-kpi-grid">
                    <div class="rax-reports-kpi-card">
                        <div class="rax-reports-kpi-label">Total Leads</div>
                        <div class="rax-reports-kpi-value">${data.total_leads || 0}</div>
                        <div class="rax-reports-kpi-trend ${trends.total_leads.positive ? 'positive' : 'negative'}">
                            <span>${trends.total_leads.positive ? '↑' : '↓'}</span>
                            <span>${trends.total_leads.value}% vs last month</span>
                        </div>
                    </div>
                    <div class="rax-reports-kpi-card">
                        <div class="rax-reports-kpi-label">Conversions</div>
                        <div class="rax-reports-kpi-value">${data.conversions || 0}</div>
                        <div class="rax-reports-kpi-trend ${trends.conversions.positive ? 'positive' : 'negative'}">
                            <span>${trends.conversions.positive ? '↑' : '↓'}</span>
                            <span>${trends.conversions.value}% vs last month</span>
                        </div>
                    </div>
                    <div class="rax-reports-kpi-card">
                        <div class="rax-reports-kpi-label">Active Leads</div>
                        <div class="rax-reports-kpi-value">${data.active_leads || 0}</div>
                        <div class="rax-reports-kpi-trend ${trends.active_leads.positive ? 'positive' : 'negative'}">
                            <span>${trends.active_leads.positive ? '↑' : '↓'}</span>
                            <span>${trends.active_leads.value}% vs last month</span>
                        </div>
                    </div>
                    <div class="rax-reports-kpi-card">
                        <div class="rax-reports-kpi-label">Revenue</div>
                        <div class="rax-reports-kpi-value">$${formatNumber(data.revenue || 0)}</div>
                        <div class="rax-reports-kpi-trend ${trends.revenue.positive ? 'positive' : 'negative'}">
                            <span>${trends.revenue.positive ? '↑' : '↓'}</span>
                            <span>${trends.revenue.value}% vs last month</span>
                        </div>
                    </div>
                </div>
                
                <div class="rax-reports-chart-container">
                    <h3 class="rax-reports-chart-title">Monthly Performance</h3>
                    <p class="rax-reports-chart-subtitle">Lead acquisition over the selected period</p>
                    <div class="rax-reports-chart-wrapper" id="monthly-performance-chart"></div>
                </div>
                
                <div class="rax-reports-chart-container">
                    <h3 class="rax-reports-chart-title">Lead Status Breakdown</h3>
                    <table class="rax-reports-status-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Count</th>
                                <th>Percentage</th>
                                <th>Visual</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(data.status_breakdown || []).map(status => {
                                const total = data.total_leads || 1;
                                const percentage = Math.round((status.count / total) * 100);
                                return `
                                    <tr>
                                        <td style="text-transform: capitalize; font-weight: 500;">${status.status}</td>
                                        <td>${status.count}</td>
                                        <td>${percentage}%</td>
                                        <td>
                                            <div class="rax-reports-progress-bar">
                                                <div class="rax-reports-progress-fill" style="width: ${percentage}%"></div>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Render monthly performance chart
            if (data.monthly_performance && data.monthly_performance.length > 0) {
                renderMonthlyPerformanceChart(data.monthly_performance);
            }
        }
        
        function renderPerformanceReport(data) {
            const content = document.getElementById('rax-reports-content');
            const trends = data.trends || {};
            
            content.innerHTML = `
                <div class="rax-reports-kpi-grid">
                    <div class="rax-reports-kpi-card">
                        <div class="rax-reports-kpi-label">Average Lead Value</div>
                        <div class="rax-reports-kpi-value">$${formatNumber(data.avg_lead_value || 0)}</div>
                        <div class="rax-reports-kpi-trend ${trends.avg_lead_value?.change >= 0 ? 'positive' : 'negative'}">
                            <span>${trends.avg_lead_value?.change >= 0 ? '↑' : '↓'}</span>
                            <span>${Math.abs(trends.avg_lead_value?.change_percent || 0)}% vs previous period</span>
                        </div>
                    </div>
                    <div class="rax-reports-kpi-card">
                        <div class="rax-reports-kpi-label">Average Response Time</div>
                        <div class="rax-reports-kpi-value">${data.avg_response_time || 0}h</div>
                        <div class="rax-reports-kpi-trend positive">
                            <span>↑</span>
                            <span>Improved</span>
                        </div>
                    </div>
                    <div class="rax-reports-kpi-card">
                        <div class="rax-reports-kpi-label">Win Rate</div>
                        <div class="rax-reports-kpi-value">${data.win_rate || 0}%</div>
                        <div class="rax-reports-kpi-trend ${trends.win_rate?.change >= 0 ? 'positive' : 'negative'}">
                            <span>${trends.win_rate?.change >= 0 ? '↑' : '↓'}</span>
                            <span>${Math.abs(trends.win_rate?.change_percent || 0)}% vs previous period</span>
                        </div>
                    </div>
                    <div class="rax-reports-kpi-card">
                        <div class="rax-reports-kpi-label">Conversion Rate</div>
                        <div class="rax-reports-kpi-value">${data.conversion_rate || 0}%</div>
                        <div class="rax-reports-kpi-trend ${trends.conversion_rate?.change >= 0 ? 'positive' : 'negative'}">
                            <span>${trends.conversion_rate?.change >= 0 ? '↑' : '↓'}</span>
                            <span>${Math.abs(trends.conversion_rate?.change_percent || 0)}% vs previous period</span>
                        </div>
                    </div>
                </div>
                
                <div class="rax-reports-chart-container">
                    <h3 class="rax-reports-chart-title">Performance Trends</h3>
                    <p class="rax-reports-chart-subtitle">Comparison of key metrics over time</p>
                    <div class="rax-reports-chart-wrapper" id="performance-trends-chart"></div>
                </div>
            `;
            
            // Render performance trends chart
            renderPerformanceTrendsChart(trends);
        }
        
        function renderSourceAnalysisReport(data) {
            const content = document.getElementById('rax-reports-content');
            
            content.innerHTML = `
                <div class="rax-reports-chart-container">
                    <h3 class="rax-reports-chart-title">Lead Sources Distribution</h3>
                    <p class="rax-reports-chart-subtitle">Visual breakdown of leads by source</p>
                    <div class="rax-reports-chart-wrapper" id="source-chart"></div>
                </div>
                
                <div class="rax-reports-chart-container">
                    <h3 class="rax-reports-chart-title">Source Performance</h3>
                    <table class="rax-reports-source-table">
                        <thead>
                            <tr>
                                <th>Source</th>
                                <th>Total Leads</th>
                                <th>Conversions</th>
                                <th>Conversion Rate</th>
                                <th>Revenue</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(data.sources || []).map(source => `
                                <tr>
                                    <td style="font-weight: 500;">${source.source}</td>
                                    <td>${source.total_leads}</td>
                                    <td>${source.conversions}</td>
                                    <td>${source.conversion_rate}%</td>
                                    <td>$${formatNumber(source.revenue)}</td>
                                    <td>${source.percentage}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Render source chart
            if (data.sources && data.sources.length > 0) {
                renderSourceChart(data.sources);
            }
        }
        
        function renderConversionReport(data) {
            const content = document.getElementById('rax-reports-content');
            const funnel = data.funnel || [];
            const maxCount = Math.max(...funnel.map(s => s.count), 1);
            
            content.innerHTML = `
                <div class="rax-reports-chart-container">
                    <h3 class="rax-reports-chart-title">Conversion Funnel</h3>
                    <p class="rax-reports-chart-subtitle">Lead progression through stages</p>
                    <div class="rax-reports-funnel">
                        ${funnel.map(stage => {
                            const percentage = maxCount > 0 ? Math.round((stage.count / maxCount) * 100) : 0;
                            return `
                                <div class="rax-reports-funnel-stage">
                                    <div class="rax-reports-funnel-label">${stage.stage}</div>
                                    <div class="rax-reports-funnel-bar">
                                        <div class="rax-reports-funnel-fill" style="width: ${percentage}%"></div>
                                        <div class="rax-reports-funnel-value">${stage.count} leads</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="rax-reports-chart-container">
                    <h3 class="rax-reports-chart-title">Monthly Conversion Value Trends</h3>
                    <p class="rax-reports-chart-subtitle">Conversion value over time</p>
                    <div class="rax-reports-chart-wrapper" id="conversion-trends-chart"></div>
                </div>
            `;
            
            // Render conversion trends chart
            if (data.monthly_trends && data.monthly_trends.length > 0) {
                renderConversionTrendsChart(data.monthly_trends);
            }
        }
        
        function renderActivityReport(data) {
            const content = document.getElementById('rax-reports-content');
            
            content.innerHTML = `
                <div class="rax-reports-activity-grid">
                    <div class="rax-reports-activity-card">
                        <div class="rax-reports-activity-icon">📧</div>
                        <div class="rax-reports-activity-label">Emails Sent</div>
                        <div class="rax-reports-activity-value">${data.emails_sent || 0}</div>
                    </div>
                    <div class="rax-reports-activity-card">
                        <div class="rax-reports-activity-icon">📞</div>
                        <div class="rax-reports-activity-label">Calls Made</div>
                        <div class="rax-reports-activity-value">${data.calls_made || 0}</div>
                    </div>
                    <div class="rax-reports-activity-card">
                        <div class="rax-reports-activity-icon">📅</div>
                        <div class="rax-reports-activity-label">Meetings Scheduled</div>
                        <div class="rax-reports-activity-value">${data.meetings_scheduled || 0}</div>
                    </div>
                    <div class="rax-reports-activity-card">
                        <div class="rax-reports-activity-icon">📊</div>
                        <div class="rax-reports-activity-label">Total Activities</div>
                        <div class="rax-reports-activity-value">${data.total_activities || 0}</div>
                    </div>
                </div>
                
                <div class="rax-reports-chart-container">
                    <h3 class="rax-reports-chart-title">Activity Trends</h3>
                    <p class="rax-reports-chart-subtitle">Daily activity over the selected period</p>
                    <div class="rax-reports-chart-wrapper" id="activity-trends-chart"></div>
                </div>
                
                <div class="rax-reports-chart-container">
                    <h3 class="rax-reports-chart-title">Activity Breakdown</h3>
                    <table class="rax-reports-source-table">
                        <thead>
                            <tr>
                                <th>Activity Type</th>
                                <th>Count</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(data.activity_breakdown || []).map(activity => {
                                const total = data.total_activities || 1;
                                const percentage = Math.round((activity.count / total) * 100);
                                return `
                                    <tr>
                                        <td style="text-transform: capitalize; font-weight: 500;">${activity.type}</td>
                                        <td>${activity.count}</td>
                                        <td>${percentage}%</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Render activity trends chart
            if (data.trends && data.trends.length > 0) {
                renderActivityTrendsChart(data.trends);
            }
        }
        
        // Chart rendering functions using custom SVG charts
        function renderMonthlyPerformanceChart(data) {
            const container = document.getElementById('monthly-performance-chart');
            if (!container) return;
            
            container.innerHTML = '<div id="monthly-chart-inner"></div>';
            const chartContainer = document.getElementById('monthly-chart-inner');
            
            const chartData = data.map(item => ({
                month: formatMonthLabel(item.month),
                leads: item.leads
            }));
            
            // Use custom SVG chart rendering
            renderSimpleLineChart(chartContainer, chartData, 'leads', '#6366f1', 'Monthly Leads');
        }
        
        function renderPerformanceTrendsChart(trends) {
            const container = document.getElementById('performance-trends-chart');
            if (!container) return;
            
            container.innerHTML = '<div id="performance-chart-inner"></div>';
            const chartContainer = document.getElementById('performance-chart-inner');
            
            const chartData = [
                { period: 'Previous', avgValue: trends.avg_lead_value?.previous || 0, winRate: trends.win_rate?.previous || 0, conversionRate: trends.conversion_rate?.previous || 0 },
                { period: 'Current', avgValue: trends.avg_lead_value?.current || 0, winRate: trends.win_rate?.current || 0, conversionRate: trends.conversion_rate?.current || 0 }
            ];
            
            renderMultiLineChart(chartContainer, chartData, [
                { key: 'avgValue', color: '#6366f1', name: 'Avg Lead Value' },
                { key: 'winRate', color: '#10b981', name: 'Win Rate %' },
                { key: 'conversionRate', color: '#f59e0b', name: 'Conversion Rate %' }
            ]);
        }
        
        function renderSourceChart(sources) {
            const container = document.getElementById('source-chart');
            if (!container) return;
            
            container.innerHTML = '<div id="source-chart-inner"></div>';
            const chartContainer = document.getElementById('source-chart-inner');
            
            const chartData = sources.map(s => ({ name: s.source, value: s.total_leads }));
            const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#6b7280'];
            
            renderPieChart(chartContainer, chartData, COLORS);
        }
        
        function renderConversionTrendsChart(data) {
            const container = document.getElementById('conversion-trends-chart');
            if (!container) return;
            
            container.innerHTML = '<div id="conversion-chart-inner"></div>';
            const chartContainer = document.getElementById('conversion-chart-inner');
            
            const chartData = data.map(item => ({
                month: formatMonthLabel(item.month),
                conversions: item.conversions,
                value: item.value
            }));
            
            renderDualAxisChart(chartContainer, chartData, [
                { key: 'conversions', color: '#6366f1', name: 'Conversions', type: 'line' },
                { key: 'value', color: '#10b981', name: 'Value ($)', type: 'line' }
            ]);
        }
        
        function renderActivityTrendsChart(data) {
            const container = document.getElementById('activity-trends-chart');
            if (!container) return;
            
            container.innerHTML = '<div id="activity-chart-inner"></div>';
            const chartContainer = document.getElementById('activity-chart-inner');
            
            const chartData = data.map(item => ({
                date: formatDateLabel(item.date),
                count: item.count
            }));
            
            renderBarChart(chartContainer, chartData, 'count', '#6366f1', 'Activities');
        }
        
        // Simple chart rendering helpers using SVG
        function renderSimpleLineChart(container, data, dataKey, color, name) {
            if (!container) return;
            
            // Create a simple SVG-based line chart
            const width = container.offsetWidth || 800;
            const height = 300;
            const margin = { top: 20, right: 30, bottom: 40, left: 50 };
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;
            
            const maxValue = Math.max(...data.map(d => d[dataKey]), 0);
            const xScale = chartWidth / (data.length - 1 || 1);
            const yScale = chartHeight / (maxValue || 1);
            
            let svg = container.querySelector('svg');
            if (svg) svg.remove();
            
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);
            svg.style.display = 'block';
            
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
            
            // Draw grid lines
            for (let i = 0; i <= 5; i++) {
                const y = (chartHeight / 5) * i;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', 0);
                line.setAttribute('y1', y);
                line.setAttribute('x2', chartWidth);
                line.setAttribute('y2', y);
                line.setAttribute('stroke', '#e5e7eb');
                line.setAttribute('stroke-dasharray', '3 3');
                g.appendChild(line);
            }
            
            // Draw line
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            let pathData = '';
            data.forEach((point, index) => {
                const x = index * xScale;
                const y = chartHeight - (point[dataKey] * yScale);
                pathData += (index === 0 ? 'M' : 'L') + ` ${x} ${y}`;
            });
            path.setAttribute('d', pathData);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '2');
            g.appendChild(path);
            
            // Draw points
            data.forEach((point, index) => {
                const x = index * xScale;
                const y = chartHeight - (point[dataKey] * yScale);
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', 4);
                circle.setAttribute('fill', color);
                g.appendChild(circle);
            });
            
            // Draw X-axis labels
            data.forEach((point, index) => {
                const x = index * xScale;
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', x);
                text.setAttribute('y', chartHeight + 20);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '12');
                text.setAttribute('fill', '#6b7280');
                text.textContent = point.month || point.date || '';
                g.appendChild(text);
            });
            
            svg.appendChild(g);
            container.appendChild(svg);
        }
        
        function renderMultiLineChart(container, data, lines) {
            // Simplified multi-line chart
            lines.forEach((line, index) => {
                const lineData = data.map(d => ({ x: d.period, y: d[line.key] }));
                setTimeout(() => {
                    renderSimpleLineChart(container, lineData.map((d, i) => ({ month: d.x, [line.key]: d.y })), line.key, line.color, line.name);
                }, index * 100);
            });
        }
        
        function renderPieChart(container, data, colors) {
            if (!container) return;
            
            const size = 300;
            const radius = 100;
            const centerX = size / 2;
            const centerY = size / 2;
            
            let svg = container.querySelector('svg');
            if (svg) svg.remove();
            
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', size);
            svg.setAttribute('height', size);
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
            
            const total = data.reduce((sum, d) => sum + d.value, 0);
            let currentAngle = -Math.PI / 2;
            
            data.forEach((item, index) => {
                const angle = (item.value / total) * 2 * Math.PI;
                const x1 = centerX + radius * Math.cos(currentAngle);
                const y1 = centerY + radius * Math.sin(currentAngle);
                const x2 = centerX + radius * Math.cos(currentAngle + angle);
                const y2 = centerY + radius * Math.sin(currentAngle + angle);
                
                const largeArc = angle > Math.PI ? 1 : 0;
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`);
                path.setAttribute('fill', colors[index % colors.length]);
                path.setAttribute('stroke', 'white');
                path.setAttribute('stroke-width', '2');
                svg.appendChild(path);
                
                // Add label
                const labelAngle = currentAngle + angle / 2;
                const labelX = centerX + (radius * 0.7) * Math.cos(labelAngle);
                const labelY = centerY + (radius * 0.7) * Math.sin(labelAngle);
                
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', labelX);
                text.setAttribute('y', labelY);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '12');
                text.setAttribute('fill', 'white');
                text.setAttribute('font-weight', '600');
                text.textContent = `${Math.round((item.value / total) * 100)}%`;
                svg.appendChild(text);
                
                currentAngle += angle;
            });
            
            container.appendChild(svg);
            
            // Add legend
            const legend = document.createElement('div');
            legend.style.cssText = 'display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-top: 20px;';
            data.forEach((item, index) => {
                const legendItem = document.createElement('div');
                legendItem.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 13px;';
                const colorBox = document.createElement('div');
                colorBox.style.cssText = `width: 12px; height: 12px; background: ${colors[index % colors.length]}; border-radius: 2px;`;
                legendItem.appendChild(colorBox);
                const label = document.createElement('span');
                label.textContent = `${item.name} (${item.value})`;
                legendItem.appendChild(label);
                legend.appendChild(legendItem);
            });
            container.appendChild(legend);
        }
        
        function renderDualAxisChart(container, data, lines) {
            renderSimpleLineChart(container, data, lines[0].key, lines[0].color, lines[0].name);
        }
        
        function renderBarChart(container, data, dataKey, color, name) {
            if (!container) return;
            
            const width = container.offsetWidth || 800;
            const height = 300;
            const margin = { top: 20, right: 30, bottom: 40, left: 50 };
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;
            
            const maxValue = Math.max(...data.map(d => d[dataKey]), 0);
            const barWidth = chartWidth / data.length;
            const yScale = chartHeight / (maxValue || 1);
            
            let svg = container.querySelector('svg');
            if (svg) svg.remove();
            
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);
            svg.style.display = 'block';
            
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
            
            // Draw bars
            data.forEach((point, index) => {
                const barHeight = point[dataKey] * yScale;
                const x = index * barWidth;
                const y = chartHeight - barHeight;
                
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', x + barWidth * 0.1);
                rect.setAttribute('y', y);
                rect.setAttribute('width', barWidth * 0.8);
                rect.setAttribute('height', barHeight);
                rect.setAttribute('fill', color);
                rect.setAttribute('rx', '4');
                g.appendChild(rect);
                
                // Add value label
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', x + barWidth / 2);
                text.setAttribute('y', y - 5);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '11');
                text.setAttribute('fill', '#374151');
                text.textContent = point[dataKey];
                g.appendChild(text);
                
                // Add date label
                const dateText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                dateText.setAttribute('x', x + barWidth / 2);
                dateText.setAttribute('y', chartHeight + 20);
                dateText.setAttribute('text-anchor', 'middle');
                dateText.setAttribute('font-size', '11');
                dateText.setAttribute('fill', '#6b7280');
                dateText.textContent = point.date || '';
                g.appendChild(dateText);
            });
            
            svg.appendChild(g);
            container.appendChild(svg);
        }
        
        function formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        function formatNumber(num) {
            if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'k';
            }
            return num.toFixed(0);
        }
        
        function formatMonthLabel(monthStr) {
            const date = new Date(monthStr);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
        
        function formatDateLabel(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        function exportReport(format) {
            alert(`Exporting report as ${format.toUpperCase()}...\n\nThis feature will generate and download the report in the selected format.`);
            // In a real implementation, this would make an API call to generate the export
        }
    }
    
})();
