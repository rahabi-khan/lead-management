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
            <div class="rax-lms-container">
                ${renderNavigation()}
                <div id="rax-lms-content">Loading...</div>
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
            <nav class="rax-lms-nav">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <button class="rax-lms-nav-item ${currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
                        Dashboard
                    </button>
                    <button class="rax-lms-nav-item ${currentView === 'leads' ? 'active' : ''}" data-view="leads">
                        Leads
                    </button>
                    ${showAdminOnly ? `
                        <button class="rax-lms-nav-item ${currentView === 'analytics' ? 'active' : ''}" data-view="analytics">
                            Analytics
                        </button>
                        <button class="rax-lms-nav-item ${currentView === 'segments' ? 'active' : ''}" data-view="segments">
                            Segments
                        </button>
                        <button class="rax-lms-nav-item ${currentView === 'tags' ? 'active' : ''}" data-view="tags">
                            Tags
                        </button>
                    ` : ''}
                    <button class="rax-lms-nav-item ${currentView === 'calendar' ? 'active' : ''}" data-view="calendar">
                        Calendar
                    </button>
                    ${showAdminOnly ? `
                        <button class="rax-lms-nav-item ${currentView === 'settings' ? 'active' : ''}" data-view="settings">
                            Settings
                        </button>
                    ` : ''}
                </div>
                <div style="margin-left: auto; display: flex; align-items: center; gap: 16px;">
                    ${isUserAdmin ? `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 12px; background: var(--rax-gray-100); border-radius: 20px;">
                            <span style="font-size: 12px; font-weight: 500; color: var(--rax-gray-700);">Employee</span>
                            <label class="rax-lms-view-toggle">
                                <input type="checkbox" id="view-mode-toggle" ${viewMode === 'admin' ? 'checked' : ''}>
                                <span class="rax-lms-view-toggle-slider"></span>
                            </label>
                            <span style="font-size: 12px; font-weight: 500; color: var(--rax-gray-700);">Admin</span>
                        </div>
                    ` : ''}
                    ${currentView === 'dashboard' ? `
                        <button class="rax-lms-btn rax-lms-btn-sm rax-lms-btn-secondary" id="refresh-dashboard" title="Refresh Dashboard">
                            🔄 Refresh
                        </button>
                    ` : ''}
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
                <div>
                    ${isEmployeeView ? `
                        <div style="background: linear-gradient(135deg, var(--rax-primary), var(--rax-secondary)); color: white; padding: 20px; border-radius: var(--rax-border-radius); margin-bottom: 24px;">
                            <h3 style="margin: 0 0 8px 0; font-size: 18px;">👤 Employee View</h3>
                            <p style="margin: 0; font-size: 14px; opacity: 0.9;">You're viewing your assigned leads and tasks. Switch to Admin view for full access.</p>
                        </div>
                    ` : ''}
                    ${renderKPICards(stats)}
                    ${!isEmployeeView ? `
                        <div class="rax-lms-charts-grid">
                            ${renderStatusChart(stats.by_status || {})}
                            ${renderSourceChart(stats.by_source || {})}
                        </div>
                    ` : ''}
                    ${renderActivityFeed(recentLeads.items || [])}
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading dashboard: ${error.message}</div>`;
        }
    }
    
    function renderKPICards(stats) {
        return `
            <div class="rax-lms-kpi-grid">
                <div class="rax-lms-kpi-card">
                    <div class="rax-lms-kpi-label">Total Leads</div>
                    <div class="rax-lms-kpi-value">${formatNumber(stats.total || 0)}</div>
                </div>
                <div class="rax-lms-kpi-card">
                    <div class="rax-lms-kpi-label">New Leads (7 days)</div>
                    <div class="rax-lms-kpi-value">${formatNumber(stats.new_7d || 0)}</div>
                </div>
                <div class="rax-lms-kpi-card">
                    <div class="rax-lms-kpi-label">Conversion Rate</div>
                    <div class="rax-lms-kpi-value">${stats.conversion_rate || 0}%</div>
                </div>
                <div class="rax-lms-kpi-card">
                    <div class="rax-lms-kpi-label">Estimated Lead Value</div>
                    <div class="rax-lms-kpi-value">$${formatNumber(stats.estimated_lead_value || 0)}</div>
                    <div class="rax-lms-kpi-change">Avg: $${stats.average_lead_value || 0} per lead</div>
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
                <div class="rax-lms-chart-title">Recent Activity</div>
                ${leads.length > 0 ? leads.map(lead => `
                    <div class="rax-lms-activity-item">
                        <div class="rax-lms-activity-icon">👤</div>
                        <div class="rax-lms-activity-content">
                            <div class="rax-lms-activity-text">
                                <strong>${escapeHtml(lead.name)}</strong> (${escapeHtml(lead.email)}) was added from ${formatSourceName(lead.source)}
                            </div>
                            <div class="rax-lms-activity-meta">
                                ${formatDate(lead.created_at)}
                            </div>
                        </div>
                    </div>
                `).join('') : '<div class="rax-lms-empty">No recent activity</div>'}
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
                <td><strong>${escapeHtml(lead.name)}</strong></td>
                <td>${escapeHtml(lead.email)}</td>
                ${viewMode === 'admin' ? `
                    <td><span class="rax-lms-badge rax-lms-badge-source rax-lms-badge-source-${lead.source}">${formatSourceName(lead.source)}</span></td>
                ` : ''}
                <td><span class="rax-lms-badge rax-lms-badge-status-${lead.status}">${lead.status}</span></td>
                <td><span class="rax-lms-badge rax-lms-badge-priority-${lead.priority}">${lead.priority}</span></td>
                ${viewMode === 'admin' ? `
                    <td>${escapeHtml(assignedUser)}</td>
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
                <div class="rax-lms-details-field">
                    <div class="rax-lms-details-label">Name</div>
                    <div class="rax-lms-details-value">${escapeHtml(lead.name)}</div>
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
            <div class="rax-lms-modal-overlay" id="add-lead-modal">
                <div class="rax-lms-modal">
                    <div class="rax-lms-modal-header">
                        <h2 class="rax-lms-modal-title">Add New Lead</h2>
                        <button class="rax-lms-modal-close" id="close-modal">×</button>
                    </div>
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
                        <div class="rax-lms-modal-actions">
                            <button type="button" class="rax-lms-btn rax-lms-btn-secondary" id="cancel-add-lead">Cancel</button>
                            <button type="submit" class="rax-lms-btn rax-lms-btn-primary">Add Lead</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }
    
    // Event handlers
    function attachEventListeners() {
        // Navigation
        document.querySelectorAll('.rax-lms-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.dataset.view) {
                    currentView = e.target.dataset.view;
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
                    const adminOnlyPages = ['analytics', 'segments', 'tags', 'settings'];
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
                refreshBtn.innerHTML = '🔄 Refreshing...';
                await renderApp();
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '🔄 Refresh';
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
            if (window.Recharts && document.getElementById('lead-trends-chart')) {
                const LeadTrendsChart = React.createElement(window.Recharts.LineChart, {
                    width: 400,
                    height: 300,
                    data: analytics.lead_trends.map(t => ({ date: t.date.split('-')[2], count: t.count }))
                }, [
                    React.createElement(window.Recharts.CartesianGrid, { strokeDasharray: '3 3', key: 'grid' }),
                    React.createElement(window.Recharts.XAxis, { dataKey: 'date', key: 'xaxis' }),
                    React.createElement(window.Recharts.YAxis, { key: 'yaxis' }),
                    React.createElement(window.Recharts.Tooltip, { key: 'tooltip' }),
                    React.createElement(window.Recharts.Line, { type: 'monotone', dataKey: 'count', stroke: '#6366f1', key: 'line' })
                ]);
                
                // For simplicity, we'll use a custom chart implementation instead of React
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
            if (container) container.innerHTML = '<div class="rax-lms-empty">No data available</div>';
            return;
        }
        
        const maxValue = Math.max(...data.map(d => d[valueKey] || 0));
        const chartHeight = 250;
        const barWidth = Math.max(20, (container.offsetWidth - 40) / data.length - 10);
        
        let chartHTML = `<div style="padding: 20px;">`;
        
        if (Array.isArray(data) && data[0].date) {
            // Line/Bar chart for trends
            data.forEach((item, index) => {
                const height = (item[valueKey] / maxValue) * chartHeight;
                const x = (index * (barWidth + 10)) + 20;
                chartHTML += `
                    <div style="position: absolute; left: ${x}px; bottom: 20px; width: ${barWidth}px;">
                        <div style="height: ${height}px; background: linear-gradient(180deg, var(--rax-primary), var(--rax-secondary)); border-radius: 4px 4px 0 0;"></div>
                        <div style="text-align: center; font-size: 10px; margin-top: 4px; color: var(--rax-gray-600);">${item.date ? item.date.split('-')[2] : item.name}</div>
                    </div>
                `;
            });
        } else {
            // Bar chart for distribution/performance
            data.forEach((item, index) => {
                const height = ((item[valueKey] || 0) / maxValue) * chartHeight;
                const x = (index * (barWidth + 10)) + 20;
                const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
                chartHTML += `
                    <div style="position: absolute; left: ${x}px; bottom: 20px; width: ${barWidth}px;">
                        <div style="height: ${height}px; background: ${colors[index % colors.length]}; border-radius: 4px 4px 0 0;"></div>
                        <div style="text-align: center; font-size: 10px; margin-top: 4px; color: var(--rax-gray-600);">${item.name || item.source || ''}</div>
                        <div style="text-align: center; font-size: 9px; color: var(--rax-gray-500);">${item[valueKey]}</div>
                    </div>
                `;
            });
        }
        
        chartHTML += `</div><div style="position: relative; height: ${chartHeight + 40}px;"></div>`;
        container.innerHTML = chartHTML;
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
        const modal = document.getElementById('add-lead-modal');
        if (!modal) return;
        
        const closeModal = () => {
            modal.remove();
        };
        
        document.getElementById('close-modal')?.addEventListener('click', closeModal);
        document.getElementById('cancel-add-lead')?.addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        document.getElementById('add-lead-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            try {
                await api.post('leads', data);
                showNotification('Lead added successfully', 'success');
                closeModal();
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
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Analytics Page
    async function renderAnalytics() {
        try {
            const analytics = await api.get('analytics');
            
            return `
                <div>
                    <div class="rax-lms-kpi-grid">
                        <div class="rax-lms-kpi-card">
                            <div class="rax-lms-kpi-label">Avg Lead Value</div>
                            <div class="rax-lms-kpi-value">$${formatNumber(analytics.avg_lead_value || 0)}</div>
                        </div>
                        <div class="rax-lms-kpi-card">
                            <div class="rax-lms-kpi-label">Total Pipeline</div>
                            <div class="rax-lms-kpi-value">$${formatNumber(analytics.total_pipeline || 0)}</div>
                        </div>
                        <div class="rax-lms-kpi-card">
                            <div class="rax-lms-kpi-label">Conversion Rate</div>
                            <div class="rax-lms-kpi-value">${analytics.conversion_rate || 0}%</div>
                        </div>
                        <div class="rax-lms-kpi-card">
                            <div class="rax-lms-kpi-label">Time to Close</div>
                            <div class="rax-lms-kpi-value">${analytics.time_to_close || 0} days</div>
                        </div>
                    </div>
                    <div class="rax-lms-charts-grid" style="grid-template-columns: repeat(2, 1fr);">
                        <div class="rax-lms-chart-card">
                            <div class="rax-lms-chart-title">Lead Trends (30 Days)</div>
                            <div id="lead-trends-chart" style="height: 300px;"></div>
                        </div>
                        <div class="rax-lms-chart-card">
                            <div class="rax-lms-chart-title">Revenue Trends (30 Days)</div>
                            <div id="revenue-trends-chart" style="height: 300px;"></div>
                        </div>
                        <div class="rax-lms-chart-card">
                            <div class="rax-lms-chart-title">Status Distribution</div>
                            <div id="status-distribution-chart" style="height: 300px;"></div>
                        </div>
                        <div class="rax-lms-chart-card">
                            <div class="rax-lms-chart-title">Source Performance</div>
                            <div id="source-performance-chart" style="height: 300px;"></div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            return `<div class="rax-lms-loading">Error loading analytics: ${error.message}</div>`;
        }
    }
    
    // Segments Page
    async function renderSegments() {
        try {
            const data = await api.get('segments');
            
            return `
                <div>
                    <div class="rax-lms-kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
                        <div class="rax-lms-kpi-card">
                            <div class="rax-lms-kpi-label">Total Segments</div>
                            <div class="rax-lms-kpi-value">${data.total_segments || 0}</div>
                        </div>
                        <div class="rax-lms-kpi-card">
                            <div class="rax-lms-kpi-label">Average Segment Size</div>
                            <div class="rax-lms-kpi-value">${data.avg_segment_size || 0}</div>
                        </div>
                        <div class="rax-lms-kpi-card">
                            <div class="rax-lms-kpi-label">Total Leads in Segments</div>
                            <div class="rax-lms-kpi-value">${data.segments.reduce((sum, s) => sum + s.count, 0)}</div>
                        </div>
                    </div>
                    <div class="rax-lms-table-container" style="margin-top: 24px;">
                        <div class="rax-lms-table-header">
                            <div class="rax-lms-table-title">Lead Segments</div>
                        </div>
                        <div style="padding: 20px;">
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
                                ${data.segments.map(segment => `
                                    <div class="rax-lms-details-card">
                                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                                            <div>
                                                <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">${escapeHtml(segment.name)}</h3>
                                                <p style="margin: 0; font-size: 12px; color: var(--rax-gray-600);">${escapeHtml(segment.description)}</p>
                                            </div>
                                            <span class="rax-lms-badge rax-lms-badge-priority-medium">${segment.count} leads</span>
                                        </div>
                                        <div style="margin-bottom: 12px;">
                                            <div style="font-size: 11px; color: var(--rax-gray-500); margin-bottom: 4px;">Criteria:</div>
                                            <div style="font-size: 12px; color: var(--rax-gray-700); font-family: monospace; background: var(--rax-gray-50); padding: 8px; border-radius: 4px;">${escapeHtml(segment.criteria)}</div>
                                        </div>
                                        <button class="rax-lms-btn rax-lms-btn-primary" style="width: 100%;" 
                                                onclick="window.raxLMSViewSegment(${segment.id})">
                                            View Leads
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
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
        await renderApp();
    });
    
})();

