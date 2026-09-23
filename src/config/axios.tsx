import { getCurrentUserToken } from "@/utils/helpers/getCurrentUser";
import axios from "axios";

const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,

    headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "69420",
        // "X-Custom-Header": "foobar",
    },

    // params: {
    //   ID: 12345,
    // },
});
// Add a request interceptor
axiosInstance.interceptors.request.use(
    function (config) {
        // const id_token = 'token token';
        const id_token = getCurrentUserToken();

        try {
            if (!!id_token) {
                // @ts-ignore
                config.headers["Authorization"] = `Bearer ${id_token}`;
            }
            return config;
        } catch (err) {
            console.log("error in axios", err);
        }

        // Do something before request is sent
        return config;
    },
    function (error) {
        // Do something with request error
        return Promise.reject(error);
    }
);

// Add a response interceptord
axiosInstance.interceptors.response.use(
    function (response: any) {
        // response.status === 200 &&
        //     !!response.data.message &&
        //     showNotify('success', response.data.message);
        return response?.data;
    },
    function (error) {
        if (error.response && error.response.status === 403) {

            //when 401 i.e unauthorized comes
            //write function to clear session
            // console.log('its 401')
            // const navigate = useNavigate()
            // store.dispatch(logout());
            // navigate('/')
            // window.history.pushState({},'','/')
            // store.dispatch(errorNotify('authentication error'));
        }



        return Promise.reject(error?.response?.data?.message);
    }
);

export default axiosInstance;
