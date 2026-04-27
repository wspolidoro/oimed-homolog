//const API_ENDPOINT = 'https://blue.api.painelw.com.br/api/sandbox/franqueado/clientes';  
const API_ENDPOINT = 'https://parceiro.painelw.com.br/api/cadastrar/clientes/newform?familiar=false'
//const API_ENDPOINT = 'http://localhost:3035/api/cadastrar/clientes/newform?familiar=false';
const formElement = document.getElementById('cadastroForm');
const submitBtn = document.getElementById('submitBtn');
const defaultButtonContent = submitBtn.innerHTML;

const staticPayload = {
  paymentType: "S",
  serviceType: 'G',
  cpfTitular: 'titular',
  id_franqueado: '133',
  link: window.location.href
};

const normalizeDigits = (value = '') => value.replace(/\D/g, '');
const formatBrazilDate = (value = '') => {
  if (value === '') {
    return '';
  }
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

const formatCPF = (value = '') => {
  const digits = normalizeDigits(value).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  let formatted = part1;
  if (part2) formatted += `.${part2}`;
  if (part3) formatted += `.${part3}`;
  if (part4) formatted += `-${part4}`;
  return formatted;
};

const formatPhone = (value = '') => {
  const digits = normalizeDigits(value).slice(0, 11);
  const ddd = digits.slice(0, 2);
  const nine = digits.slice(2, 7);
  const rest = digits.slice(7, 11);
  if (!ddd) return '';
  if (digits.length <= 2) return ddd;
  if (digits.length <= 7) return `(${ddd}) ${nine}`;
  return `(${ddd}) ${nine}-${rest}`;
};

const addMaskListeners = (selector, formatter) => {
  document.querySelectorAll(selector).forEach((field) => {
    field.addEventListener('input', (event) => {
      event.target.value = formatter(event.target.value);
      event.target.setSelectionRange(event.target.value.length, event.target.value.length);
    });
  });
};

const showAlert = (icon, title, text) => {
  Swal.fire({
    icon,
    title,
    text,
    confirmButtonColor: '#4d4fff'
  });
};

const stateSelect = document.getElementById('state');
const citySelect = document.getElementById('city');
const includeDependentsCheckbox = document.getElementById('includeDependents');
const dependentsCountSelect = document.getElementById('dependentsCount');
const dependentsCountWrapper = document.getElementById('dependentsCountWrapper');
const dependentsContainer = document.getElementById('dependentsContainer');
const dependentSections = Array.from(document.querySelectorAll('[data-dependent-index]'));

const setDependentVisibility = (count) => {
  dependentSections.forEach((section) => {
    const index = Number(section.dataset.dependentIndex);
    const shouldShow = index > 0 && index <= count;
    section.classList.toggle('hidden', !shouldShow);
    section.querySelectorAll('input').forEach((input) => {
      input.required = shouldShow;
    });
  });
};

const clearDependentInputs = () => {
  dependentSections.forEach((section) => {
    section.querySelectorAll('input').forEach((input) => {
      input.value = '';
      input.required = false;
    });
  });
};

const toggleDependentsUI = () => {
  if (!includeDependentsCheckbox || !dependentsContainer || !dependentsCountSelect) return;
  if (!includeDependentsCheckbox.checked) {
    dependentsContainer.classList.add('hidden');
    dependentsCountWrapper?.classList.add('hidden');
    dependentsCountSelect.disabled = true;
    dependentsCountSelect.value = '';
    setDependentVisibility(0);
    clearDependentInputs();
    return;
  }

  dependentsContainer.classList.remove('hidden');
  dependentsCountWrapper?.classList.remove('hidden');
  dependentsCountSelect.disabled = false;
  const selectedCount = Number(dependentsCountSelect.value) || 1;
  dependentsCountSelect.value = String(selectedCount);
  setDependentVisibility(selectedCount);
};

const handleDependentsCountChange = (event) => {
  if (!includeDependentsCheckbox?.checked) {
    setDependentVisibility(0);
    return;
  }
  const selected = Number(event.target.value) || 0;
  setDependentVisibility(selected);
};

const initializeDependentsSection = () => {
  setDependentVisibility(0);
  clearDependentInputs();
  if (dependentsContainer) {
    dependentsContainer.classList.add('hidden');
  }
  if (dependentsCountSelect) {
    dependentsCountSelect.value = '';
    dependentsCountSelect.disabled = true;
  }
  dependentsCountWrapper?.classList.add('hidden');
};

const IBGE_STATES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome';
const IBGE_CITIES_URL = (uf) =>
  `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`;


const populateStateOptions = (states = []) => {
  if (!stateSelect) return;
  stateSelect.innerHTML = '<option value="">Selecione um estado</option>';
  states.forEach((state) => {
    const stateName = state?.nome;
    const stateCode = state?.sigla;
    if (!stateName || !stateCode) return;
    const option = document.createElement('option');
    option.value = stateCode;
    option.textContent = stateName;
    stateSelect.appendChild(option);
  });
  stateSelect.disabled = false;
};

const populateCityOptions = (cities = [], placeholder = 'Selecione uma cidade') => {
  if (!citySelect) return;
  citySelect.innerHTML = `<option value="">${placeholder}</option>`;
  cities.forEach((city) => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    citySelect.appendChild(option);
  });
  citySelect.disabled = cities.length === 0;
};

const loadStates = async () => {
  if (!stateSelect) return;
  stateSelect.innerHTML = '<option value="">Carregando estados...</option>';
  stateSelect.disabled = true;
  try {
    const response = await fetch(IBGE_STATES_URL);
    const data = await response.json();
    if (Array.isArray(data)) {
      populateStateOptions(data);
    }
    console.log("very:", data)
  } catch (error) {
    console.log("very:", data)
    console.error('Erro ao carregar estados do Brasil:', error);
    if (stateSelect) {
      stateSelect.innerHTML = '<option value="">Erro ao carregar estados</option>';
      stateSelect.disabled = true;
    }
  }
};

const loadCitiesForState = async (stateCode) => {
  if (!citySelect) return;
  if (!stateCode) {
    populateCityOptions([], 'Selecione primeiro o estado');
    return;
  }
  citySelect.innerHTML = '<option value="">Carregando cidades...</option>';
  citySelect.disabled = true;
  try {
    const response = await fetch(IBGE_CITIES_URL(stateCode));
    const data = await response.json();
    if (Array.isArray(data)) {
      populateCityOptions(data.map((city) => city?.nome).filter(Boolean), 'Selecione a cidade');
    } else {
      throw new Error('Resposta inválida');
    }
  } catch (error) {
    console.error('Erro ao carregar cidades do Brasil:', error);
    if (citySelect) {
      citySelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
      citySelect.disabled = true;
    }
  }
};

if (stateSelect) {
  stateSelect.addEventListener('change', (event) => {
    const selectedState = event.target.value;
    if (!selectedState) {
      populateCityOptions([], 'Selecione primeiro o estado');
      return;
    }

    loadCitiesForState(selectedState);
  });

  populateCityOptions([], 'Selecione primeiro o estado');
  loadStates();
}

addMaskListeners('#nu_documento', formatCPF);
addMaskListeners('#telefone', formatPhone);
addMaskListeners('.dependent-cpf', formatCPF);
addMaskListeners('.dependent-phone', formatPhone);

if (includeDependentsCheckbox) {
  includeDependentsCheckbox.addEventListener('change', toggleDependentsUI);
}

if (dependentsCountSelect) {
  dependentsCountSelect.addEventListener('change', handleDependentsCountChange);
}

initializeDependentsSection();

formElement.addEventListener('submit', async (event) => {
  event.preventDefault();
  //console.log(formElement.checkValidity())
  if (formElement.checkValidity() === false) {
    formElement.classList.add('was-validated');
    return;
  }

  formElement.classList.remove('was-validated');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Enviando <span class="tm-spinner" role="status" aria-hidden="true"></span>';

  const formData = new FormData(formElement);
  const includeDependents = includeDependentsCheckbox?.checked || false;
  const dependentsCount = Number(formData.get('dependentsCount')) || 0;
  const dependentsPayload = [];
  if (includeDependents && dependentsCount > 0) {
    for (let index = 1; index <= dependentsCount; index += 1) {
      dependentsPayload.push({
        nm_dependente: formData.get(`dependent_${index}_name`)?.trim(),
        nu_documento: normalizeDigits(formData.get(`dependent_${index}_document`)),
        birthday: formatBrazilDate(formData.get(`dependent_${index}_birthday`)),
        telefone: normalizeDigits(formData.get(`dependent_${index}_telefone`)),
        email: formData.get(`dependent_${index}_email`)?.trim()
      });
    }
  }

  const payload = {
    nm_cliente: formData.get('nm_cliente').trim(),
    nu_documento: normalizeDigits(formData.get('nu_documento')),
    birthday: formatBrazilDate(formData.get('birthday')),
    telefone: normalizeDigits(formData.get('telefone')),
    email: formData.get('email').trim(),
    zip_code: normalizeDigits(formData.get('zip_code')),
    address: formData.get('address').trim(),
    city: formData.get('city').trim(),
    state: formData.get('state'),
    includeDependents,
    dependentsCount,
    dependents: dependentsPayload,
    ...staticPayload
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json().catch(() => null);
    if (response.ok === false) {
      const errorMessage = responseData?.message || 'Não foi possível concluir o cadastro.';
      throw new Error(errorMessage);
    }

    showAlert('success', 'Cadastro enviado', 'Recebemos os dados e vamos confirmar o cadastro em instantes.')
    .then(result => {
      if (result.isConfirmed) {
        window.location.href = 'https://medycco.com.br';
      }
    });
    formElement.reset();
  } catch (error) {
    console.error(error);
    showAlert('error', 'Erro no envio', error.message || 'Tente novamente mais tarde.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = defaultButtonContent;
  }
});
