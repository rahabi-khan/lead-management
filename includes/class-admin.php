<?php
/**
 * Admin interface for Rax Lead Management System
 */

if (!defined('ABSPATH')) {
    exit;
}

class Rax_LMS_Admin {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_assets'));
    }
    
    public function add_admin_menu() {
        add_menu_page(
            __('Lead Management', 'rax-lms'),
            __('Lead Management', 'rax-lms'),
            'manage_options',
            'rax-lead-management',
            array($this, 'render_admin_page'),
            'dashicons-groups',
            30
        );
        
        add_submenu_page(
            'rax-lead-management',
            __('Reports', 'rax-lms'),
            __('Reports', 'rax-lms'),
            'manage_options',
            'rax-lead-reports',
            array($this, 'render_reports_page')
        );
    }
    
    public function enqueue_assets($hook) {
        if (strpos($hook, 'rax-lead-management') === false && strpos($hook, 'rax-lead-reports') === false) {
            return;
        }
        
        // Enqueue Chart.js for reports page
        if (strpos($hook, 'rax-lead-reports') !== false) {
            wp_enqueue_script(
                'chartjs',
                'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
                array(),
                '4.4.0',
                false
            );
        } else {
            // Enqueue Recharts library for main admin page
            wp_enqueue_script(
                'recharts',
                'https://unpkg.com/recharts@2.10.3/umd/Recharts.js',
                array(),
                '2.10.3',
                false
            );
        }
        
        // Enqueue CSS
        wp_enqueue_style(
            'rax-lms-admin',
            RAX_LMS_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            RAX_LMS_VERSION
        );
        
        // Enqueue JS
        wp_enqueue_script(
            'rax-lms-admin',
            RAX_LMS_PLUGIN_URL . 'assets/js/admin.js',
            strpos($hook, 'rax-lead-reports') !== false ? array('chartjs') : array('recharts'),
            RAX_LMS_VERSION,
            true
        );
        
        // Get current user role
        $current_user = wp_get_current_user();
        $user_roles = $current_user->roles;
        $is_admin = in_array('administrator', $user_roles) || current_user_can('manage_options');
        
        // Localize script
        wp_localize_script('rax-lms-admin', 'raxLMS', array(
            'apiUrl' => rest_url('rax-lms/v1/'),
            'nonce' => wp_create_nonce('wp_rest'),
            'currentUser' => get_current_user_id(),
            'userRole' => !empty($user_roles) ? $user_roles[0] : 'subscriber',
            'isAdmin' => $is_admin,
            'users' => $this->get_users_list(),
            'currentUserDisplayName' => $current_user->display_name,
            'currentUserEmail' => $current_user->user_email
        ));
    }
    
    private function get_users_list() {
        $users = get_users(array('fields' => array('ID', 'display_name')));
        $list = array();
        foreach ($users as $user) {
            $list[] = array(
                'id' => $user->ID,
                'name' => $user->display_name
            );
        }
        return $list;
    }
    
    public function render_admin_page() {
        ?>
        <div class="wrap rax-lms-admin">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <div id="rax-lms-app"></div>
        </div>
        <?php
    }
    
    public function render_reports_page() {
        $current_user = wp_get_current_user();
        ?>
        <div class="rax-reports-page">
            <!-- Header -->
            <div class="rax-reports-header">
                <div class="rax-reports-header-left">
                    <h1 class="rax-reports-logo">wpmanage ninja</h1>
                </div>
                <div class="rax-reports-header-right">
                    <span class="rax-reports-date"><?php echo date('M d, Y'); ?></span>
                    <span class="rax-reports-time"><?php echo date('g:i A'); ?></span>
                    <div class="rax-reports-user">
                        <div class="rax-reports-user-avatar"><?php echo strtoupper(substr($current_user->display_name, 0, 1)); ?></div>
                        <span class="rax-reports-user-name"><?php echo esc_html($current_user->display_name); ?></span>
                    </div>
                </div>
            </div>
            
            <div class="rax-reports-container">
                <!-- Sidebar -->
                <div class="rax-reports-sidebar">
                    <nav class="rax-reports-nav">
                        <a href="<?php echo admin_url('admin.php?page=rax-lead-management'); ?>" class="rax-reports-nav-item">
                            <span class="dashicons dashicons-email-alt"></span> Forms
                        </a>
                        <a href="#" class="rax-reports-nav-item">
                            <span class="dashicons dashicons-phone"></span> Calls
                        </a>
                        <a href="#" class="rax-reports-nav-item">
                            <span class="dashicons dashicons-calendar-alt"></span> Calendly
                        </a>
                        <a href="<?php echo admin_url('admin.php?page=rax-lead-reports'); ?>" class="rax-reports-nav-item active">
                            <span class="dashicons dashicons-chart-bar"></span> Reports
                        </a>
                        <a href="#" class="rax-reports-nav-item">
                            <span class="dashicons dashicons-trash"></span> Trash
                        </a>
                        <a href="#" class="rax-reports-nav-item">
                            <span class="dashicons dashicons-backup"></span> History
                        </a>
                        <a href="#" class="rax-reports-nav-item">
                            <span class="dashicons dashicons-admin-settings"></span> Settings
                        </a>
                    </nav>
                    
                    <div class="rax-reports-filters">
                        <div class="rax-reports-filter-section">
                            <div class="rax-reports-filter-title">
                                <span>Products</span>
                                <span class="dashicons dashicons-arrow-down-alt2"></span>
                            </div>
                            <div class="rax-reports-filter-content">
                                <label><input type="checkbox" checked> All</label>
                                <label><input type="checkbox" checked> Fluent Forms</label>
                                <label><input type="checkbox" checked> FluentCRM</label>
                                <label><input type="checkbox" checked> FluentCart</label>
                                <label><input type="checkbox" checked> FluentBooking</label>
                                <label><input type="checkbox" checked> Fluent Support</label>
                                <label><input type="checkbox" checked> FluentSMTP</label>
                                <label><input type="checkbox" checked> FluentAffiliate</label>
                                <label><input type="checkbox" checked> FluentCommunity</label>
                                <label><input type="checkbox" checked> FluentBoards</label>
                                <label><input type="checkbox" checked> WP Social Ninja</label>
                                <label><input type="checkbox" checked> Ninja Tables</label>
                                <label><input type="checkbox" checked> Paymattic</label>
                                <label><input type="checkbox" checked> Azonpress</label>
                                <label><input type="checkbox" checked> Fluent Members</label>
                            </div>
                        </div>
                        <div class="rax-reports-filter-section">
                            <div class="rax-reports-filter-title">
                                <span>Platform</span>
                                <span class="dashicons dashicons-arrow-down-alt2"></span>
                            </div>
                        </div>
                        <div class="rax-reports-filter-section">
                            <div class="rax-reports-filter-title">
                                <span>Media</span>
                                <span class="dashicons dashicons-arrow-down-alt2"></span>
                            </div>
                        </div>
                        <div class="rax-reports-filter-section">
                            <div class="rax-reports-filter-title">
                                <span>Topic</span>
                                <span class="dashicons dashicons-arrow-down-alt2"></span>
                            </div>
                        </div>
                        <div class="rax-reports-filter-section">
                            <div class="rax-reports-filter-title">
                                <span>Qualify</span>
                                <span class="dashicons dashicons-arrow-down-alt2"></span>
                            </div>
                        </div>
                        <div class="rax-reports-filter-section">
                            <div class="rax-reports-filter-title">
                                <span>Status</span>
                                <span class="dashicons dashicons-arrow-down-alt2"></span>
                            </div>
                        </div>
                        <div class="rax-reports-filter-section">
                            <div class="rax-reports-filter-title">
                                <span>Location</span>
                                <span class="dashicons dashicons-arrow-down-alt2"></span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Main Content -->
                <div class="rax-reports-main">
                    <div class="rax-reports-content">
                        <h2 class="rax-reports-page-title">Short Term Reports</h2>
                        
                        <div class="rax-reports-tabs">
                            <button class="rax-reports-tab active" data-tab="short-term">Short Term Reports</button>
                            <button class="rax-reports-tab" data-tab="long-term">Long Term Reports</button>
                        </div>
                        
                        <div class="rax-reports-toolbar">
                            <div class="rax-reports-search">
                                <input type="text" placeholder="Q Search" class="rax-reports-search-input">
                            </div>
                            <div class="rax-reports-date-picker">
                                <input type="text" id="rax-reports-date-range" class="rax-reports-date-input" readonly>
                                <span class="dashicons dashicons-calendar-alt"></span>
                            </div>
                        </div>
                        
                        <!-- Leads Breakdown -->
                        <div class="rax-reports-section">
                            <h3 class="rax-reports-section-title">Leads Breakdown</h3>
                            <div class="rax-reports-cards-grid" id="leads-breakdown">
                                <!-- Cards will be populated by JS -->
                            </div>
                        </div>
                        
                        <!-- Average Daily Lead -->
                        <div class="rax-reports-section">
                            <h3 class="rax-reports-section-title">Average Daily Lead</h3>
                            <div class="rax-reports-cards-grid" id="average-daily-lead">
                                <!-- Cards will be populated by JS -->
                            </div>
                        </div>
                        
                        <!-- Charts Row 1 -->
                        <div class="rax-reports-charts-row">
                            <div class="rax-reports-chart-card">
                                <h3 class="rax-reports-chart-title">Form Lead - Daily</h3>
                                <canvas id="form-lead-daily-chart"></canvas>
                            </div>
                            <div class="rax-reports-chart-card">
                                <h3 class="rax-reports-chart-title">Form Lead By Programs</h3>
                                <canvas id="form-lead-programs-chart"></canvas>
                            </div>
                        </div>
                        
                        <!-- Charts Row 2 -->
                        <div class="rax-reports-charts-row">
                            <div class="rax-reports-chart-card">
                                <h3 class="rax-reports-chart-title">Locations</h3>
                                <canvas id="locations-chart"></canvas>
                            </div>
                            <div class="rax-reports-chart-card">
                                <h3 class="rax-reports-chart-title">Form Leads From Top Platform</h3>
                                <canvas id="platform-leads-chart"></canvas>
                                <div id="platform-leads-table"></div>
                            </div>
                        </div>
                        
                        <!-- Last 12 Months Table -->
                        <div class="rax-reports-section">
                            <h3 class="rax-reports-section-title">Last 12 Months Lead</h3>
                            <div class="rax-reports-table-container">
                                <table class="rax-reports-table" id="last-12-months-table">
                                    <!-- Table will be populated by JS -->
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}

