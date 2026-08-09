import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform } from 'react-native';
import { useAuth, isAdmin } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  AcademicYearScreen,
  AuditLogsScreen,
  PromotionPreviewScreen,
  PromotionRulesScreen,
  TeacherDetailScreen,
  TeachersScreen,
} from '../screens/AdminScreens';
import { ProfileScreen, SettingsScreen } from '../screens/AccountScreens';
import {
  AttendanceHistoryScreen,
  AttendanceHomeScreen,
  MarkAttendanceScreen,
} from '../screens/AttendanceScreens';
import { ClassesScreen, ClassFormScreen } from '../screens/ClassesScreens';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MoreScreen } from '../screens/MoreScreen';
import {
  AlumniScreen,
  ImportStudentsScreen,
  StudentDetailScreen,
  StudentFormScreen,
  StudentsScreen,
} from '../screens/StudentsScreens';

const Root = createNativeStackNavigator();
const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const stackOptions = {
  headerBackTitle: 'Back',
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 17 },
};

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function AttendanceStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen
        name="AttendanceHome"
        component={AttendanceHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MarkAttendance"
        component={MarkAttendanceScreen}
        options={{ title: 'Mark Attendance' }}
      />
      <Stack.Screen
        name="AttendanceHistory"
        component={AttendanceHistoryScreen}
        options={{ title: 'Attendance History' }}
      />
    </Stack.Navigator>
  );
}

function StudentsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen
        name="Students"
        component={StudentsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="StudentDetail"
        component={StudentDetailScreen}
        options={{ title: 'Student Profile' }}
      />
      <Stack.Screen
        name="StudentForm"
        component={StudentFormScreen}
        options={({ route }: any) => ({
          title: route.params?.id ? 'Edit Student' : 'Add Student',
        })}
      />
      <Stack.Screen name="ImportStudents" component={ImportStudentsScreen} options={{ title: 'Import Students' }} />
      <Stack.Screen name="Alumni" component={AlumniScreen} />
    </Stack.Navigator>
  );
}

function ClassesStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen
        name="Classes"
        component={ClassesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ClassForm"
        component={ClassFormScreen}
        options={({ route }: any) => ({
          title: route.params?.id ? 'Edit Class' : 'Create Class',
        })}
      />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen
        name="More"
        component={MoreScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AcademicYear"
        component={AcademicYearScreen}
        options={{ title: 'Academic Year' }}
      />
      <Stack.Screen
        name="PromotionRules"
        component={PromotionRulesScreen}
        options={{ title: 'Promotion Rules' }}
      />
      <Stack.Screen name="Alumni" component={AlumniScreen} />
      <Stack.Screen
        name="StudentDetail"
        component={StudentDetailScreen}
        options={{ title: 'Student Profile' }}
      />
      <Stack.Screen
        name="PromotionPreview"
        component={PromotionPreviewScreen}
        options={{ title: 'Promotion Preview' }}
      />
      <Stack.Screen
        name="AuditLogs"
        component={AuditLogsScreen}
        options={{ title: 'Audit Logs' }}
      />
      <Stack.Screen
        name="Teachers"
        component={TeachersScreen}
        options={{ title: 'Teachers & Staff' }}
      />
      <Stack.Screen
        name="TeacherDetail"
        component={TeacherDetailScreen}
        options={{ title: 'Teacher Profile' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'My Profile' }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const icons: Record<
    string,
    [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]
  > = {
    DashboardTab: ['grid', 'grid-outline'],
    AttendanceTab: ['calendar', 'calendar-outline'],
    StudentsTab: ['people', 'people-outline'],
    ClassesTab: ['library', 'library-outline'],
    MoreTab: ['apps', 'apps-outline'],
  };

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 88 : 72,
          paddingTop: 9,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundColor: colors.surface,
          shadowColor: '#10203a',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.09,
          shadowRadius: 12,
          elevation: 14,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          paddingBottom: Platform.OS === 'ios' ? 0 : 8,
        },
        tabBarIcon: ({ focused, color }) => (
          <Ionicons
            name={icons[route.name]?.[focused ? 0 : 1] || 'ellipse-outline'}
            size={25}
            color={color}
          />
        ),
      })}
    >
      <Tabs.Screen
        name="DashboardTab"
        component={DashboardStack}
        options={{ title: 'Dashboard' }}
      />
      <Tabs.Screen
        name="AttendanceTab"
        component={AttendanceStack}
        options={{ title: 'Attendance' }}
      />
      <Tabs.Screen
        name="StudentsTab"
        component={StudentsStack}
        listeners={({ navigation }) => ({
          tabPress: () => navigation.navigate('StudentsTab', { screen: 'Students' }),
        })}
        options={{ title: 'Students', popToTopOnBlur: true }}
      />
      {admin && (
        <Tabs.Screen
          name="ClassesTab"
          component={ClassesStack}
          options={{ title: 'Classes' }}
        />
      )}
      <Tabs.Screen
        name="MoreTab"
        component={MoreStack}
        options={{ title: 'More' }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { user } = useAuth();
  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      <Root.Screen
        name={user ? 'Main' : 'Login'}
        component={user ? MainTabs : LoginScreen}
      />
    </Root.Navigator>
  );
}
